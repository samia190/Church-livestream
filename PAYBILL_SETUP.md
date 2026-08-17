# Safaricom M-PESA PayBill Setup

The donation form now uses a **Safaricom M-PESA PayBill STK Push** instead of a Till Number. A donor enters the phone number registered to M-PESA, submits the donation, and receives a payment prompt on that phone. The donor completes the transaction by entering their M-PESA PIN.

## Required server configuration

Copy the relevant values into the deployment environment. Keep the consumer secret and passkey server-side; do not expose them through `VITE_` variables or commit them to source control.

| Variable                    | Purpose                                                      | Example                                       |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `MPESA_BASE_URL`            | Daraja API base URL                                          | `https://sandbox.safaricom.co.ke` for testing |
| `MPESA_CONSUMER_KEY`        | Daraja app consumer key                                      | Supplied by Safaricom Daraja                  |
| `MPESA_CONSUMER_SECRET`     | Daraja app consumer secret                                   | Supplied by Safaricom Daraja                  |
| `MPESA_PAYBILL_NUMBER`      | The church’s PayBill short code                              | `123456`                                      |
| `MPESA_PASSKEY`             | Lipa na M-PESA Online passkey for the PayBill                | Supplied by Safaricom                         |
| `MPESA_TRANSACTION_TYPE`    | STK transaction type                                         | `CustomerPayBillOnline`                       |
| `PUBLIC_BASE_URL`           | Public HTTPS origin used to build the callback URL           | `https://your-domain.example`                 |
| `VITE_MPESA_PAYBILL_NUMBER` | Optional public copy of the PayBill number shown in the form | `123456`                                      |

The previous `MPESA_SHORTCODE` setting is no longer used for this flow. Set `MPESA_PAYBILL_NUMBER` to the actual PayBill number instead. The frontend variable is optional and may be left empty if the number should not be displayed in the donation form.

## Callback URL

The server constructs the callback URL as:

```text
https://your-domain.example/api/payments/mpesa/callback
```

This endpoint must be reachable over HTTPS from Safaricom’s systems and must not require a user login. The callback matches the `CheckoutRequestID` returned by the STK Push request to the pending donation, verifies the amount and M-PESA receipt number, and then marks the donation as completed or failed.

## PayBill STK Push behavior

For the prompt flow, the configured PayBill number is sent as both `BusinessShortCode` and `PartyB`, with `TransactionType=CustomerPayBillOnline`. The donor’s phone is normalized to the Kenyan `2547...` or `2541...` format before the request is sent. Donations are restricted to KES for M-PESA.

This implementation is different from a manual PayBill instruction page. It does not ask the donor to type a PayBill number into their phone manually; it sends the prompt directly to the M-PESA-registered phone number supplied in the form.

## Giving purposes and account references

The Give page presents a purpose selector with common church giving categories, including Tithe, Offering, Thanksgiving, Special Sacrifice, Pledge, Project Support, Building Fund, Missions & Evangelism, Church Outreach, Welfare & Benevolence, Youth Ministry, Children’s Ministry, Women’s Ministry, Men’s Ministry, Choir & Worship, Media & Technology, Conference or Event, Prayer & Care Support, General Donation, and Other.

When the donor selects **Project Support**, the form shows a project selector. The current project choices include Community Water, Student Support, Healthcare Ministry, Skills Training, Church Building, and Community Outreach. The selected purpose and project are stored in the donation description and converted server-side into a compact PayBill `AccountReference`, for example `TITHE`, `OFFER`, or `PROJ-WATER`. The donor does not need a membership number, donor account number, or manually typed reference. The server validates the purpose and project combination before starting the STK Push.

Name and email are optional for public giving. Email is presented as an optional receipt contact, while the M-PESA-registered phone number remains required for the STK Push method. Prayer is presented as **Prayer & Care Support** so that prayer itself is not represented as a required paid service.

## Testing sequence

Use the Safaricom sandbox base URL and sandbox credentials first. Confirm that the public callback URL points to the active environment, submit a small test donation, approve the prompt on the test phone, and verify that the donation changes from `pending` to `completed` with the returned M-PESA receipt. Switch `MPESA_BASE_URL` to the production Daraja endpoint only after Safaricom has enabled the PayBill and production credentials.

The official Daraja portal is available at [Safaricom Developers](https://developer.safaricom.co.ke/apis). Production onboarding, credentials, and callback registration remain dependent on the PayBill account and Safaricom’s current requirements.
