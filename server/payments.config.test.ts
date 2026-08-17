import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  createPaypalOrder,
  createStripeCheckoutSession,
  initiateMpesa,
  newIdempotencyKey,
  verifyStripeWebhook,
} from "./_core/payments";

describe("payment provider safety", () => {
  it("generates UUID idempotency keys", () => {
    const first = newIdempotencyKey();
    const second = newIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second).not.toBe(first);
  });

  it("rejects M-Pesa without a Kenyan phone number before making a provider call", async () => {
    await expect(
      initiateMpesa({
        amount: 100,
        currency: "KES",
        donorName: "Test Donor",
        email: "test@example.com",
        callbackBaseUrl: "http://localhost:3000",
        reference: newIdempotencyKey(),
      })
    ).rejects.toThrow("Kenyan M-Pesa phone number");
  });

  it("fails closed when the PayBill number is not configured", async () => {
    const previousPaybill = process.env.MPESA_PAYBILL_NUMBER;
    delete process.env.MPESA_PAYBILL_NUMBER;
    await expect(
      initiateMpesa({
        amount: 100,
        currency: "KES",
        donorName: "Test Donor",
        email: "test@example.com",
        phone: "0712345678",
        callbackBaseUrl: "http://localhost:3000",
        reference: newIdempotencyKey(),
      })
    ).rejects.toThrow("MPESA_PAYBILL_NUMBER is not configured");
    if (previousPaybill) process.env.MPESA_PAYBILL_NUMBER = previousPaybill;
  });

  it("uses the configured PayBill number for the STK Push payload", async () => {
    const keys = [
      "MPESA_PAYBILL_NUMBER",
      "MPESA_PASSKEY",
      "MPESA_CONSUMER_KEY",
      "MPESA_CONSUMER_SECRET",
    ] as const;
    const previous = Object.fromEntries(
      keys.map(key => [key, process.env[key]])
    ) as Record<string, string | undefined>;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-token" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ResponseCode: "0",
            CheckoutRequestID: "ws_CO_test",
            CustomerMessage: "Success",
          }),
          { status: 200 }
        )
      );

    process.env.MPESA_PAYBILL_NUMBER = "123456";
    process.env.MPESA_PASSKEY = "test-passkey";
    process.env.MPESA_CONSUMER_KEY = "test-key";
    process.env.MPESA_CONSUMER_SECRET = "test-secret";

    try {
      const result = await initiateMpesa({
        amount: 100,
        currency: "KES",
        donorName: "Test Donor",
        email: "test@example.com",
        phone: "0712345678",
        callbackBaseUrl: "https://example.com",
        reference: "PROJ-WATER",
      });

      const [, request] = fetchMock.mock.calls[1] ?? [];
      const payload = JSON.parse(String((request as RequestInit)?.body));
      expect(result.providerReference).toBe("ws_CO_test");
      expect(payload.BusinessShortCode).toBe("123456");
      expect(payload.PartyB).toBe("123456");
      expect(payload.TransactionType).toBe("CustomerPayBillOnline");
      expect(payload.AccountReference).toBe("PROJ-WATER");
    } finally {
      fetchMock.mockRestore();
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });

  it("creates a Stripe Checkout Session with donation metadata", async () => {
    const previousSecret = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "cs_test_123",
          url: "https://checkout.stripe.com/c/pay/cs_test_123",
        }),
        { status: 200 }
      )
    );

    try {
      const result = await createStripeCheckoutSession({
        amount: 25,
        currency: "USD",
        donorName: "International Donor",
        email: "donor@example.com",
        callbackBaseUrl: "https://example.com",
        reference: "PROJ-WATER",
        purpose: "Project Support — Community Water Project",
        donationId: "donation-123",
      });
      const [url, request] = fetchMock.mock.calls[0] ?? [];
      const params = new URLSearchParams(
        String((request as RequestInit)?.body)
      );

      expect(result.provider).toBe("stripe");
      expect(result.providerReference).toBe("cs_test_123");
      expect(result.approvalUrl).toBe(
        "https://checkout.stripe.com/c/pay/cs_test_123"
      );
      expect(String(url)).toContain("/checkout/sessions");
      expect(params.get("mode")).toBe("payment");
      expect(params.get("line_items[0][price_data][currency]")).toBe("usd");
      expect(params.get("line_items[0][price_data][unit_amount]")).toBe("2500");
      expect(params.get("metadata[donationId]")).toBe("donation-123");
      expect(params.get("metadata[givingReference]")).toBe("PROJ-WATER");
    } finally {
      fetchMock.mockRestore();
      if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousSecret;
    }
  });

  it("verifies a Stripe webhook signature using the raw payload", () => {
    const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", "whsec_test")
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    try {
      expect(
        verifyStripeWebhook(payload, `t=${timestamp},v1=${signature}`)
      ).toMatchObject({ type: "checkout.session.completed" });
    } finally {
      if (previousSecret === undefined)
        delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("fails closed when PayPal credentials are not configured", async () => {
    const previousId = process.env.PAYPAL_CLIENT_ID;
    const previousSecret = process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    await expect(
      createPaypalOrder({
        amount: 10,
        currency: "USD",
        donorName: "Test Donor",
        email: "test@example.com",
        callbackBaseUrl: "http://localhost:3000",
        reference: newIdempotencyKey(),
      })
    ).rejects.toThrow("PAYPAL_CLIENT_ID is not configured");
    if (previousId) process.env.PAYPAL_CLIENT_ID = previousId;
    if (previousSecret) process.env.PAYPAL_CLIENT_SECRET = previousSecret;
  });
});
