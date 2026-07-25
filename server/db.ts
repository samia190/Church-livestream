import {
  User,
  PrayerRequest,
  Donation,
  ContactMessage,
  Event,
  Sermon,
  AdminSetting,
  StreamingSession,
  PlatformConnection,
  CameraDevice,
  StreamBroadcast,
  PlatformCredential,
  SessionPlatformMap,
  type IUser,
} from "./models";
import { ENV } from "./_core/env";

// Ensure Mongoose is initialized before any query
async function ensureConnected() {
  try {
    const { connectToMongo } = await import("./mongoConnection");
    await connectToMongo();
  } catch (error) {
    console.warn("[Database] MongoDB connection failed:", error);
    throw new Error("Database not available");
  }
}

// ---- User operations ----
export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
}): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  await ensureConnected();

  try {
    const values: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    for (const field of textFields) {
      const value = (user as any)[field];
      if (value !== undefined) {
        values[field] = value ?? null;
      }
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    await User.findOneAndUpdate(
      { openId: user.openId },
      { $set: values },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<IUser | undefined> {
  await ensureConnected();
  const result = await User.findOne({ openId }).lean();
  return result ?? undefined;
}

// ---- Prayer Requests ----
export async function createPrayerRequest(data: {
  name: string;
  email: string;
  prayerRequest: string;
  isPublic: boolean;
}) {
  await ensureConnected();
  return PrayerRequest.create({
    name: data.name,
    email: data.email,
    prayerRequest: data.prayerRequest,
    isPublic: data.isPublic,
    status: "pending",
  });
}

// ---- Donations ----
export async function createDonation(data: {
  donorName: string;
  email: string;
  amount: number;
  method: "online" | "bank" | "mobile" | "inperson";
  purpose?: string;
}) {
  await ensureConnected();
  return Donation.create({
    donorName: data.donorName,
    email: data.email,
    amount: data.amount,
    currency: "KES",
    method: data.method,
    purpose: data.purpose ?? null,
    status: "pending",
  });
}

// ---- Contact Messages ----
export async function createContactMessage(data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}) {
  await ensureConnected();
  return ContactMessage.create({
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    message: data.message,
    status: "new",
  });
}

// ---- Events ----
export async function getPublishedEvents() {
  await ensureConnected();
  return Event.find({ isPublished: true }).lean();
}

export async function createEvent(data: {
  title: string;
  description?: string;
  eventType: "service" | "event" | "crusade" | "meeting" | "other";
  startDate: Date;
  endDate?: Date;
  location?: string;
  imageUrl?: string;
}) {
  await ensureConnected();
  return Event.create({
    title: data.title,
    description: data.description ?? null,
    eventType: data.eventType,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    location: data.location ?? null,
    imageUrl: data.imageUrl ?? null,
    isPublished: false,
  });
}

// ---- Sermons ----
export async function getPublishedSermons() {
  await ensureConnected();
  return Sermon.find({ isPublished: true }).lean();
}

export async function createSermon(data: {
  title: string;
  speaker?: string;
  description?: string;
  videoUrl?: string;
  audioUrl?: string;
  sermonDate: Date;
  duration?: number;
}) {
  await ensureConnected();
  return Sermon.create({
    title: data.title,
    speaker: data.speaker ?? null,
    description: data.description ?? null,
    videoUrl: data.videoUrl ?? null,
    audioUrl: data.audioUrl ?? null,
    sermonDate: data.sermonDate,
    duration: data.duration ?? null,
    isPublished: false,
  });
}

// ---- Admin Settings ----
export async function getAdminSetting(key: string) {
  await ensureConnected();
  const result = await AdminSetting.findOne({ key }).lean();
  return result ?? null;
}

export async function setAdminSetting(
  key: string,
  value: string,
  description?: string
) {
  await ensureConnected();
  return AdminSetting.findOneAndUpdate(
    { key },
    {
      key,
      value,
      description: description ?? null,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

// ---- Streaming Sessions ----
export async function createStreamingSession(data: {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  status?: "scheduled" | "live" | "ended" | "archived";
}): Promise<string> {
  await ensureConnected();
  const session = await StreamingSession.create({
    title: data.title,
    description: data.description ?? null,
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    status: data.status || "scheduled",
  });
  return session._id.toString();
}

export async function getStreamingSessions() {
  await ensureConnected();
  return StreamingSession.find({}).lean();
}

// ---- Platform Connections ----
export async function createPlatformConnection(data: {
  platform:
    | "youtube"
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "twitch";
  accountName: string;
  accessToken: string;
  refreshToken?: string;
}) {
  await ensureConnected();
  return PlatformConnection.create({
    platform: data.platform,
    accountName: data.accountName,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null,
  });
}

export async function getActivePlatformConnections() {
  await ensureConnected();
  return PlatformConnection.find({ isActive: true }).lean();
}

export async function deactivatePlatformConnection(id: string) {
  await ensureConnected();
  return PlatformConnection.findByIdAndUpdate(id, {
    isActive: false,
    updatedAt: new Date(),
  });
}

// ---- Camera Devices ----
export async function registerCameraDevice(data: {
  name: string;
  deviceId: string;
  type: "webcam" | "external" | "phone" | "other";
  resolution?: string;
  frameRate?: number;
}) {
  await ensureConnected();
  return CameraDevice.create({
    name: data.name,
    deviceId: data.deviceId,
    type: data.type,
    resolution: data.resolution ?? null,
    frameRate: data.frameRate ?? null,
    status: "available",
  });
}

export async function getAvailableCameras() {
  await ensureConnected();
  return CameraDevice.find({ isActive: true }).lean();
}

// ---- Stream Broadcasts ----
export async function createStreamBroadcast(data: {
  sessionId: string;
  platform:
    | "youtube"
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "twitch";
  broadcastUrl?: string;
}) {
  await ensureConnected();
  return StreamBroadcast.create({
    sessionId: data.sessionId,
    platform: data.platform,
    broadcastUrl: data.broadcastUrl ?? null,
    status: "pending",
  });
}

// ---- Additional streaming helpers ----
export async function getActiveStream() {
  await ensureConnected();
  const result = await StreamingSession.findOne({ status: "live" }).lean();
  return result ?? null;
}

export async function updateStreamStatus(
  sessionId: string,
  status: "scheduled" | "live" | "ended" | "archived"
) {
  await ensureConnected();
  return StreamingSession.findByIdAndUpdate(sessionId, {
    status,
    updatedAt: new Date(),
  });
}

export async function getPlatformCredentials(platform: string) {
  await ensureConnected();
  const result = await PlatformCredential.findOne({ platform }).lean();
  return result ?? null;
}

export async function savePlatformCredential(data: {
  platform: string;
  streamKey?: string;
  streamUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  accountName?: string;
}) {
  await ensureConnected();
  return PlatformCredential.create({
    platform: data.platform,
    streamKey: data.streamKey ?? null,
    streamUrl: data.streamUrl ?? null,
    apiKey: data.apiKey ?? null,
    apiSecret: data.apiSecret ?? null,
    accessToken: data.accessToken ?? null,
    refreshToken: data.refreshToken ?? null,
    accountId: data.accountId ?? null,
    accountName: data.accountName ?? null,
    isActive: true,
  });
}

export async function getSessionPlatforms(sessionId: string) {
  await ensureConnected();
  return SessionPlatformMap.find({ sessionId }).lean();
}

export async function addSessionPlatform(data: {
  sessionId: string;
  platform: string;
  broadcastUrl?: string;
}) {
  await ensureConnected();
  return SessionPlatformMap.create({
    sessionId: data.sessionId,
    platform: data.platform,
    broadcastUrl: data.broadcastUrl ?? null,
    status: "pending",
  });
}
