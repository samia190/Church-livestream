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
  type IStreamingSession,
} from "./models";
import { ENV } from "./_core/env";
import { encryptSecret } from "./_core/secrets";

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
  return (result ?? undefined) as IUser | undefined;
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
  phone?: string;
  amount: number;
  currency?: "KES" | "USD";
  method: "online" | "bank" | "mobile" | "inperson";
  provider?: "mpesa" | "paypal";
  purpose?: string;
  idempotencyKey?: string;
}) {
  await ensureConnected();
  if (data.idempotencyKey) {
    const existing = await Donation.findOne({ idempotencyKey: data.idempotencyKey }).lean();
    if (existing) return existing;
  }
  return Donation.create({
    donorName: data.donorName,
    email: data.email,
    phone: data.phone ?? null,
    amount: data.amount,
    currency: data.currency ?? "KES",
    method: data.method,
    provider: data.provider ?? null,
    purpose: data.purpose ?? null,
    status: "pending",
    idempotencyKey: data.idempotencyKey ?? null,
  });
}

export async function updateDonationProvider(id: string, providerReference: string) {
  await ensureConnected();
  return Donation.findByIdAndUpdate(id, { providerReference, updatedAt: new Date() }, { new: true }).lean();
}

export async function findDonationByProviderReference(providerReference: string) {
  await ensureConnected();
  return Donation.findOne({ providerReference }).lean();
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
    accessToken: encryptSecret(data.accessToken),
    refreshToken: encryptSecret(data.refreshToken),
  });
}

export async function getActivePlatformConnections() {
  await ensureConnected();
  return PlatformConnection.find({ isActive: true })
    .select("_id platform accountName isActive createdAt updatedAt")
    .lean();
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
  return (result ?? null) as IStreamingSession | null;
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
    streamKey: encryptSecret(data.streamKey),
    streamUrl: data.streamUrl ?? null,
    apiKey: encryptSecret(data.apiKey),
    apiSecret: encryptSecret(data.apiSecret),
    accessToken: encryptSecret(data.accessToken),
    refreshToken: encryptSecret(data.refreshToken),
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


// ---- Admin content management ----
export async function getPrayerRequests() {
  await ensureConnected();
  return PrayerRequest.find({}).sort({ createdAt: -1 }).lean();
}

export async function updatePrayerRequestStatus(
  id: string,
  status: "pending" | "approved" | "archived"
) {
  await ensureConnected();
  return PrayerRequest.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
}

export async function getDonations() {
  await ensureConnected();
  return Donation.find({}).sort({ createdAt: -1 }).lean();
}

export async function updateDonationStatus(
  id: string,
  status: "pending" | "completed" | "failed",
  transactionId?: string
) {
  await ensureConnected();
  return Donation.findOneAndUpdate(
    { _id: id, status: { $ne: "completed" } },
    { status, ...(transactionId ? { transactionId } : {}), updatedAt: new Date() },
    { new: true }
  ).lean();
}

export async function getContactMessages() {
  await ensureConnected();
  return ContactMessage.find({}).sort({ createdAt: -1 }).lean();
}

export async function updateContactMessageStatus(
  id: string,
  status: "new" | "read" | "responded"
) {
  await ensureConnected();
  return ContactMessage.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
}

export async function updateEvent(id: string, data: Partial<{
  title: string;
  description: string;
  eventType: "service" | "event" | "crusade" | "meeting" | "other";
  startDate: Date;
  endDate: Date;
  location: string;
  imageUrl: string;
  isPublished: boolean;
}>) {
  await ensureConnected();
  return Event.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true }).lean();
}

export async function deleteEvent(id: string) {
  await ensureConnected();
  return Event.findByIdAndDelete(id).lean();
}

export async function updateSermon(id: string, data: Partial<{
  title: string;
  speaker: string;
  description: string;
  videoUrl: string;
  audioUrl: string;
  sermonDate: Date;
  duration: number;
  isPublished: boolean;
}>) {
  await ensureConnected();
  return Sermon.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true }).lean();
}

export async function deleteSermon(id: string) {
  await ensureConnected();
  return Sermon.findByIdAndDelete(id).lean();
}

export async function getDashboardStats() {
  await ensureConnected();
  const [members, events, sermons, prayerRequests, donations, liveViewers] = await Promise.all([
    User.countDocuments(),
    Event.countDocuments(),
    Sermon.countDocuments(),
    PrayerRequest.countDocuments(),
    Donation.aggregate([{ $match: { status: "completed" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    StreamingSession.aggregate([{ $match: { status: "live" } }, { $group: { _id: null, total: { $sum: "$viewerCount" } } }]),
  ]);

  return {
    members,
    events,
    sermons,
    prayerRequests,
    donations: Number(donations[0]?.total ?? 0),
    liveViewers: Number(liveViewers[0]?.total ?? 0),
  };
}


export async function getAllEvents() {
  await ensureConnected();
  return Event.find({}).sort({ startDate: 1 }).lean();
}

export async function getAllSermons() {
  await ensureConnected();
  return Sermon.find({}).sort({ sermonDate: -1 }).lean();
}
