/**
 * Unified type exports
 * Import shared types from this single entry point.
 * Re-exports Mongoose model interfaces from the server.
 */

export type {
  IUser as User,
  InsertUser,
  IPrayerRequest as PrayerRequest,
  InsertPrayerRequest,
  IDonation as Donation,
  InsertDonation,
  IContactMessage as ContactMessage,
  InsertContactMessage,
  IEvent as Event,
  InsertEvent,
  ISermon as Sermon,
  InsertSermon,
  IAdminSetting as AdminSetting,
  InsertAdminSetting,
  IStreamingSession as StreamingSession,
  InsertStreamingSession,
  IPlatformConnection as PlatformConnection,
  InsertPlatformConnection,
  ICameraDevice as CameraDevice,
  InsertCameraDevice,
  IStreamBroadcast as StreamBroadcast,
  InsertStreamBroadcast,
  IPlatformCredential as PlatformCredential,
  InsertPlatformCredential,
  ISessionPlatformMap as SessionPlatformMap,
  InsertSessionPlatformMap,
} from "../server/models";

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
};

export type InsertPrayerRequest = {
  name: string;
  email: string;
  prayerRequest: string;
  isPublic?: boolean;
  status?: "pending" | "approved" | "archived";
};

export type InsertDonation = {
  donorName: string;
  email: string;
  amount: number;
  method: "online" | "bank" | "mobile" | "inperson";
  currency?: string;
  purpose?: string;
  status?: "pending" | "completed" | "failed";
  transactionId?: string;
};

export type InsertContactMessage = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  status?: "new" | "read" | "responded";
};

export type InsertEvent = {
  title: string;
  description?: string;
  eventType: "service" | "event" | "crusade" | "meeting" | "other";
  startDate: Date;
  endDate?: Date;
  location?: string;
  imageUrl?: string;
  isPublished?: boolean;
};

export type InsertSermon = {
  title: string;
  speaker?: string;
  description?: string;
  videoUrl?: string;
  audioUrl?: string;
  sermonDate: Date;
  duration?: number;
  isPublished?: boolean;
};

export type InsertAdminSetting = {
  key: string;
  value?: string;
  description?: string;
};

export type InsertStreamingSession = {
  title: string;
  description?: string;
  status?: "scheduled" | "live" | "ended" | "archived";
  startTime: Date;
  endTime?: Date;
  streamKey?: string;
  rtmpUrl?: string;
  isPublished?: boolean;
  recordingUrl?: string;
  viewerCount?: number;
};

export type InsertPlatformConnection = {
  platform: "youtube" | "facebook" | "instagram" | "tiktok" | "twitter" | "twitch";
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  isActive?: boolean;
};

export type InsertCameraDevice = {
  name: string;
  deviceId: string;
  type: "webcam" | "external" | "phone" | "other";
  status?: "available" | "in_use" | "offline";
  resolution?: string;
  frameRate?: number;
  isActive?: boolean;
};

export type InsertStreamBroadcast = {
  sessionId: string;
  platform: "youtube" | "facebook" | "instagram" | "tiktok" | "twitter" | "twitch";
  broadcastUrl?: string;
  status?: "pending" | "live" | "ended";
  viewerCount?: number;
  startTime?: Date;
  endTime?: Date;
};

export type InsertPlatformCredential = {
  platform: "youtube" | "facebook" | "instagram" | "tiktok" | "twitter" | "twitch" | "restream";
  streamKey?: string;
  streamUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  accountName?: string;
  isActive?: boolean;
  expiresAt?: Date;
};

export type InsertSessionPlatformMap = {
  sessionId: string;
  platform: "youtube" | "facebook" | "instagram" | "tiktok" | "twitter" | "twitch";
  broadcastId?: string;
  broadcastUrl?: string;
  status?: "pending" | "live" | "ended" | "failed";
  viewerCount?: number;
  startTime?: Date;
  endTime?: Date;
};

export * from "./_core/errors";
