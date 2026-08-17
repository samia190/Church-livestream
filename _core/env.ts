export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.MONGODB_URI ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  notificationWebhookToken: process.env.NOTIFICATION_WEBHOOK_TOKEN ?? "",
  notificationCronSecret: process.env.NOTIFICATION_CRON_SECRET ?? "",
  liveKitUrl: process.env.LIVEKIT_URL ?? "",
  liveKitApiKey: process.env.LIVEKIT_API_KEY ?? "",
  liveKitApiSecret: process.env.LIVEKIT_API_SECRET ?? "",
};

// Restream.io configuration
export const RESTREAM_API_KEY = process.env.RESTREAM_API_KEY || '';
export const RESTREAM_API_URL = 'https://api.restream.io/v2';
