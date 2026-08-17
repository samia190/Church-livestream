# International Payment Setup

The giving page now supports three payment paths: **M-PESA PayBill** for Kenyan donors, **PayPal** for international donors, and **Stripe-hosted Checkout** for international card payments. The application never receives or stores card numbers. Stripe hosts the card checkout page, and PayPal hosts its own approval page.

## Environment configuration

Copy the following placeholders into the deployment environment and replace them with values from each provider. Keep server-only secrets out of source control and do not prefix them with `VITE_`.

| Variable                    | Required for              | Purpose                                                                        |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `PUBLIC_BASE_URL`           | All online methods        | Public HTTPS origin used to build return and callback URLs                     |
| `MPESA_BASE_URL`            | M-PESA                    | Safaricom Daraja sandbox or production base URL                                |
| `MPESA_CONSUMER_KEY`        | M-PESA                    | Daraja consumer key                                                            |
| `MPESA_CONSUMER_SECRET`     | M-PESA                    | Daraja consumer secret                                                         |
| `MPESA_PAYBILL_NUMBER`      | M-PESA                    | Church PayBill short code                                                      |
| `MPESA_PASSKEY`             | M-PESA                    | Lipa na M-PESA Online passkey                                                  |
| `MPESA_TRANSACTION_TYPE`    | M-PESA                    | Normally `CustomerPayBillOnline`                                               |
| `PAYPAL_BASE_URL`           | PayPal                    | `https://api-m.sandbox.paypal.com` for sandbox or the production REST base URL |
| `PAYPAL_CLIENT_ID`          | PayPal                    | PayPal REST application client ID                                              |
| `PAYPAL_CLIENT_SECRET`      | PayPal                    | PayPal REST application secret                                                 |
| `PAYPAL_WEBHOOK_ID`         | PayPal                    | Webhook ID used to verify PayPal webhook signatures                            |
| `STRIPE_BASE_URL`           | Stripe                    | Normally `https://api.stripe.com/v1`                                           |
| `STRIPE_SECRET_KEY`         | Stripe                    | Stripe secret API key, such as a test or live secret key                       |
| `STRIPE_WEBHOOK_SECRET`     | Stripe                    | Signing secret for the Stripe webhook endpoint, beginning with `whsec_`        |
| `VITE_MPESA_PAYBILL_NUMBER` | Optional frontend display | Public PayBill number shown on the donation form                               |

The current `.env.example` file contains every field above with blank placeholders. Do not put `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `MPESA_CONSUMER_SECRET`, or `MPESA_PASSKEY` in the browser environment.

## Payment routes

The application uses the following provider callback routes:

| Route                          | Provider  | Purpose                                                                |
| ------------------------------ | --------- | ---------------------------------------------------------------------- |
| `/api/payments/mpesa/callback` | Safaricom | Confirms the M-PESA STK Push and receipt                               |
| `/api/payments/paypal/webhook` | PayPal    | Verifies completed PayPal captures                                     |
| `/api/payments/stripe/webhook` | Stripe    | Verifies `checkout.session.completed` and marks the donation completed |

All provider callbacks must be reachable from the public internet over HTTPS. The Stripe endpoint must be registered in the Stripe Dashboard for the exact production URL. The PayPal webhook must be registered against the PayPal application and its ID copied into `PAYPAL_WEBHOOK_ID`.

## Stripe card flow

When a donor selects **International Card (Stripe)**, the form automatically switches the currency to USD. The server creates a one-time Stripe Checkout Session with the donation amount, purpose description, project information when applicable, and donation ID in metadata. The pending donation stores the Stripe Checkout Session ID as its provider reference, and the donor is redirected to Stripe’s hosted checkout page.

After payment, Stripe redirects the donor back to the Give page. This browser redirect is only a user-experience signal; it is not treated as proof of payment. The server marks the donation completed only after receiving and verifying the Stripe `checkout.session.completed` webhook with `payment_status=paid`.

Stripe webhook signature verification requires the exact raw request body and the `Stripe-Signature` header. The server captures the raw body before JSON parsing and validates the signature using `STRIPE_WEBHOOK_SECRET`. This follows Stripe’s webhook security model.[1]

Stripe card checkout can show card wallet options supported by Stripe and eligible for the account, domain, browser, country, and customer. Apple Pay and Google Pay availability requires the relevant Stripe account and domain configuration; they should not be promised to every donor.[2]

## PayPal flow

When a donor selects **PayPal (International)**, the form switches the currency to USD. The server creates a PayPal order, redirects the donor to PayPal for approval, captures the order after the donor returns, and also verifies PayPal webhook events. PayPal credentials should be configured for sandbox testing before production credentials are used.

## Currency and donor experience

M-PESA remains restricted to KES. PayPal and Stripe are restricted to USD in this implementation. The donor’s name, email, and phone are optional unless required by the selected method; the M-PESA phone is required because it receives the STK Push. Email is presented as an optional receipt contact.

## Provider documentation

Use the official provider dashboards to create test credentials, register callback URLs, and switch to live mode only after sandbox testing is complete.

1. [Stripe Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create) and [Stripe webhook security](https://docs.stripe.com/webhooks).
2. [Stripe supported payment methods](https://docs.stripe.com/payments/payment-methods/overview), [Apple Pay](https://docs.stripe.com/apple-pay), and [Google Pay](https://docs.stripe.com/google-pay).
3. [PayPal REST webhooks](https://developer.paypal.com/api/rest/webhooks) and [PayPal webhook integration](https://developer.paypal.com/api/rest/webhooks/rest).
4. [Safaricom Daraja developer portal](https://developer.safaricom.co.ke/apis).
