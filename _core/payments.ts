import crypto from "node:crypto";

export type PaymentProvider = "mpesa" | "paypal";

export type PaymentInput = {
  amount: number;
  currency: "KES" | "USD";
  donorName: string;
  email: string;
  phone?: string;
  purpose?: string;
  callbackBaseUrl: string;
  reference: string;
  donationId?: string;
};

export type PaymentInitResult = {
  provider: PaymentProvider;
  providerReference: string;
  approvalUrl?: string;
  customerMessage: string;
};

const mpesaBaseUrl = process.env.MPESA_BASE_URL || "https://sandbox.safaricom.co.ke";
const paypalBaseUrl = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function basicAuth(clientId: string, secret: string): string {
  return Buffer.from(`${clientId}:${secret}`).toString("base64");
}

function normalizeMpesaPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  throw new Error("Use a valid Kenyan M-Pesa phone number");
}

async function getMpesaToken(): Promise<string> {
  const key = requireEnv("MPESA_CONSUMER_KEY");
  const secret = requireEnv("MPESA_CONSUMER_SECRET");
  const response = await fetch(`${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basicAuth(key, secret)}` },
  });
  if (!response.ok) throw new Error(`M-Pesa token request failed with ${response.status}`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("M-Pesa token response did not contain an access token");
  return body.access_token;
}

async function getPaypalToken(): Promise<string> {
  const clientId = requireEnv("PAYPAL_CLIENT_ID");
  const secret = requireEnv("PAYPAL_CLIENT_SECRET");
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, secret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PayPal token request failed with ${response.status}`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("PayPal token response did not contain an access token");
  return body.access_token;
}

export async function initiateMpesa(input: PaymentInput): Promise<PaymentInitResult> {
  if (input.currency !== "KES") throw new Error("M-Pesa donations must use KES");
  if (!input.phone) throw new Error("A Kenyan M-Pesa phone number is required");
  const token = await getMpesaToken();
  const shortcode = requireEnv("MPESA_SHORTCODE");
  const passkey = requireEnv("MPESA_PASSKEY");
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const callbackUrl = `${input.callbackBaseUrl.replace(/\/$/, "")}/api/payments/mpesa/callback`;
  const response = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
      Amount: Math.round(input.amount),
      PartyA: normalizeMpesaPhone(input.phone),
      PartyB: shortcode,
      PhoneNumber: normalizeMpesaPhone(input.phone),
      CallBackURL: callbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: (input.purpose || "Church donation").slice(0, 20),
    }),
  });
  if (!response.ok) throw new Error(`M-Pesa STK request failed with ${response.status}`);
  const body = (await response.json()) as { ResponseCode?: string; CheckoutRequestID?: string; CustomerMessage?: string; errorMessage?: string };
  if (body.ResponseCode !== "0" || !body.CheckoutRequestID) throw new Error(body.errorMessage || "M-Pesa STK request was not accepted");
  return { provider: "mpesa", providerReference: body.CheckoutRequestID, customerMessage: body.CustomerMessage || "Check your phone to complete the M-Pesa payment" };
}

export async function createPaypalOrder(input: PaymentInput): Promise<PaymentInitResult> {
  const token = await getPaypalToken();
  const callbackBase = input.callbackBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": input.reference,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: input.reference, description: input.purpose || "Church donation", amount: { currency_code: input.currency, value: input.amount.toFixed(2) } }],
      application_context: { return_url: `${callbackBase}/give?payment=paypal-success&donationId=${encodeURIComponent(input.donationId || "")}`, cancel_url: `${callbackBase}/give?payment=paypal-cancelled`, user_action: "PAY_NOW" },
    }),
  });
  if (!response.ok) throw new Error(`PayPal order request failed with ${response.status}`);
  const body = (await response.json()) as { id?: string; links?: Array<{ rel?: string; href?: string }> };
  const approvalUrl = body.links?.find(link => link.rel === "approve")?.href;
  if (!body.id || !approvalUrl) throw new Error("PayPal order response did not contain an approval link");
  return { provider: "paypal", providerReference: body.id, approvalUrl, customerMessage: "Continue to PayPal to complete your donation" };
}

export async function capturePaypalOrder(orderId: string): Promise<{ completed: boolean; transactionId?: string }> {
  const token = await getPaypalToken();
  const response = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`PayPal capture failed with ${response.status}`);
  const body = (await response.json()) as { status?: string; purchase_units?: Array<{ payments?: { captures?: Array<{ id?: string; status?: string }> } }> };
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  return { completed: body.status === "COMPLETED" && capture?.status === "COMPLETED", transactionId: capture?.id };
}

export async function verifyPaypalWebhook(headers: Record<string, string | undefined>, event: unknown): Promise<boolean> {
  const token = await getPaypalToken();
  const webhookId = requireEnv("PAYPAL_WEBHOOK_ID");
  const response = await fetch(`${paypalBaseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { verification_status?: string };
  return body.verification_status === "SUCCESS";
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
