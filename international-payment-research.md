# International payment research notes

## Stripe Checkout

Official source: https://docs.stripe.com/api/checkout/sessions/create

Stripe Checkout supports one-time payments with `mode=payment`. A Checkout Session requires line items for payment mode and can include a `success_url`, `cancel_url`, `metadata`, and a `client_reference_id`. The hosted Checkout Session returns a URL to which the customer is redirected. The implementation will create the session server-side and store the Stripe Checkout Session ID as the donation provider reference.

Official source: https://docs.stripe.com/webhooks

Stripe webhook events are sent to an HTTPS endpoint. Signature verification uses the `Stripe-Signature` header and the endpoint secret, and verification requires the exact raw request body. The completed payment event to handle is `checkout.session.completed`. The Express callback route must be registered before JSON body parsing or use a raw-body route so signature verification remains valid.

## PayPal

The uploaded project already has PayPal order creation, redirect approval, capture, and webhook signature verification. The international payment update should preserve that flow and ensure its environment variables are documented.

## Design decision

Keep M-PESA PayBill for Kenya, retain PayPal for international donors, and add Stripe-hosted Checkout for international card payments. Stripe-hosted Checkout can present card and other payment methods enabled in the Stripe Dashboard; Apple Pay and Google Pay availability depends on Stripe account, country, domain, browser, and customer eligibility. Never store card details in the application.
