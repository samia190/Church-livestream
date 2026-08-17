import type { Express } from "express";
import { findDonationByProviderReference, updateDonationStatus } from "../db";
import { verifyPaypalWebhook, verifyStripeWebhook } from "./payments";

function callbackValue(
  items: Array<{ Name?: string; Value?: string | number }> | undefined,
  name: string
) {
  return items?.find(item => item.Name === name)?.Value;
}

export function registerPaymentRoutes(app: Express) {
  app.post("/api/payments/mpesa/callback", async (req, res) => {
    try {
      const callback = req.body?.Body?.stkCallback;
      const checkoutRequestId = callback?.CheckoutRequestID;
      if (!checkoutRequestId)
        return res
          .status(400)
          .json({ ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" });
      const donation = (await findDonationByProviderReference(
        checkoutRequestId
      )) as any;
      if (!donation)
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
      if (callback.ResultCode !== 0) {
        await updateDonationStatus(donation._id.toString(), "failed");
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
      }
      const metadata = callback.CallbackMetadata?.Item as
        Array<{ Name?: string; Value?: string | number }> | undefined;
      const amount = Number(callbackValue(metadata, "Amount"));
      const receipt = callbackValue(metadata, "MpesaReceiptNumber");
      if (!receipt || amount !== Number(donation.amount)) {
        await updateDonationStatus(donation._id.toString(), "failed");
        return res
          .status(400)
          .json({
            ResultCode: 1,
            ResultDesc: "Payment details did not match donation",
          });
      }
      await updateDonationStatus(
        donation._id.toString(),
        "completed",
        String(receipt)
      );
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error) {
      console.error("M-Pesa callback error:", error);
      return res
        .status(500)
        .json({ ResultCode: 1, ResultDesc: "Callback processing failed" });
    }
  });

  app.post("/api/payments/stripe/webhook", async (req, res) => {
    try {
      const rawBody = (req as Express.Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody)
        return res
          .status(400)
          .json({ error: "Stripe raw request body is unavailable" });
      const event = verifyStripeWebhook(
        rawBody.toString("utf8"),
        req.header("stripe-signature")
      ) as {
        type?: string;
        data?: {
          object?: {
            id?: string;
            payment_status?: string;
            payment_intent?: string;
            metadata?: { donationId?: string };
          };
        };
      };
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const sessionId = session?.id;
        const donation = sessionId
          ? ((await findDonationByProviderReference(sessionId)) as any)
          : undefined;
        if (
          donation &&
          session?.payment_status === "paid" &&
          session.payment_intent
        ) {
          await updateDonationStatus(
            donation._id.toString(),
            "completed",
            session.payment_intent
          );
        }
      }
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      return res
        .status(400)
        .json({ error: "Stripe webhook verification failed" });
    }
  });

  app.post("/api/payments/paypal/webhook", async (req, res) => {
    try {
      const headers = Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value,
        ])
      );
      const verified = await verifyPaypalWebhook(headers, req.body);
      if (!verified)
        return res
          .status(400)
          .json({ error: "Invalid PayPal webhook signature" });
      const event = req.body as {
        event_type?: string;
        resource?: {
          id?: string;
          supplementary_data?: { related_ids?: { order_id?: string } };
        };
      };
      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const orderId =
          event.resource?.supplementary_data?.related_ids?.order_id;
        const donation = orderId
          ? ((await findDonationByProviderReference(orderId)) as any)
          : undefined;
        if (donation && event.resource?.id)
          await updateDonationStatus(
            donation._id.toString(),
            "completed",
            event.resource.id
          );
      }
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("PayPal webhook error:", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}
