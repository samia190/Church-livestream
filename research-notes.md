# Safaricom Daraja verification notes

- The official Safaricom Daraja portal is available at https://developer.safaricom.co.ke/apis and describes Daraja 3.0 as the platform for integrating M-PESA APIs.
- The legacy deep link https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate currently resolves to a 404-style portal page, so the exact request schema should be validated against the current portal or provider onboarding documentation before production credentials are configured.
- The project already uses Lipa na M-PESA Online / STK Push with `TransactionType=CustomerPayBillOnline`, `BusinessShortCode`, `PartyB`, and an STK callback endpoint.
- Planned implementation: make PayBill explicit in configuration and user-facing copy while preserving STK Push; require a PayBill number separate from any Till configuration, use it as the STK `BusinessShortCode` and `PartyB`, and keep the callback reconciliation keyed by `CheckoutRequestID`.
