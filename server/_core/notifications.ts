import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { finishNotificationDelivery, getUpcomingPrayerRoomReminderRecipients, claimNotificationDelivery } from "../db";

function isAuthorized(req: Request) {
  if (!ENV.notificationCronSecret) return false;
  const authorization = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const headerSecret = req.header("x-notification-secret") ?? "";
  return authorization === ENV.notificationCronSecret || headerSecret === ENV.notificationCronSecret;
}

async function sendWebhook(payload: unknown) {
  if (!ENV.notificationWebhookUrl) throw new Error("Notification webhook is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(ENV.notificationWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ENV.notificationWebhookToken ? { authorization: `Bearer ${ENV.notificationWebhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Notification provider returned HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchUpcomingPrayerRoomReminders() {
  const recipients = await getUpcomingPrayerRoomReminderRecipients(15, 5);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const claim = await claimNotificationDelivery({ dedupeKey: recipient.dedupeKey, userOpenId: recipient.registration.userOpenId, kind: "prayer-room", channel: "webhook" });
    if (!claim) { skipped += 1; continue; }
    try {
      await sendWebhook({
        type: "prayer_room_reminder",
        idempotencyKey: recipient.dedupeKey,
        to: { email: recipient.user.email, name: recipient.user.name ?? "NICA member" },
        subject: `Prayer Room begins soon: ${recipient.session.title}`,
        text: `Your registered Prayer Room gathering, ${recipient.session.title}, begins in about 15 minutes. Open NICA Kibugu to join when the host opens the room. Please do not forward private room details.`,
        data: {
          sessionId: String(recipient.session._id),
          title: recipient.session.title,
          startsAt: recipient.session.startsAt,
          durationMinutes: recipient.session.durationMinutes,
          mode: recipient.session.mode,
        },
      });
      await finishNotificationDelivery(recipient.dedupeKey, { status: "sent" });
      sent += 1;
    } catch (error) {
      await finishNotificationDelivery(recipient.dedupeKey, { status: "failed", error: error instanceof Error ? error.message : "Notification delivery failed" });
      failed += 1;
    }
  }
  return { matched: recipients.length, sent, skipped, failed };
}

export function registerNotificationRoutes(app: Express) {
  app.post("/api/notifications/dispatch/prayer-room", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: "Invalid notification dispatch credentials" });
      return;
    }
    if (!ENV.notificationWebhookUrl) {
      res.status(503).json({ ok: false, error: "Notification webhook is not configured" });
      return;
    }
    try {
      const result = await dispatchUpcomingPrayerRoomReminders();
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      console.error("[Notifications] Prayer Room dispatch failed:", error);
      res.status(500).json({ ok: false, error: "Notification dispatch failed" });
    }
  });
}
