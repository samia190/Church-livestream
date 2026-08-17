import { createHash, randomBytes } from "node:crypto";
import {
  User,
  PrayerRequest,
  Donation,
  ContactMessage,
  Event,
  Sermon,
  AdminSetting,
  StreamingSession,
  ProductionCameraInvitation,
  PlatformConnection,
  CameraDevice,
  StreamBroadcast,
  PlatformCredential,
  SessionPlatformMap,
  type IUser,
  type IStreamingSession,
  type IProductionCameraInvitation,
  SpiritualJourney,
  FaithJournalEntry,
  Circle,
  CircleMembership,
  CareRequest,
  CareCaseNote,
  CareCaseActivity,
  ServiceOpportunity,
  ServiceSignup,
  PrayerRoomSession,
  PrayerRoomRegistration,
  NotificationPreference,
  NotificationDelivery,
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
  ownerOpenId?: string;
  prayerRequest: string;
  isPublic: boolean;
}) {
  await ensureConnected();
  return PrayerRequest.create({
    name: data.name,
    email: data.email,
    ownerOpenId: data.ownerOpenId ?? null,
    prayerRequest: data.prayerRequest,
    isPublic: data.isPublic,
    status: "pending",
  });
}

export async function getUserPrayerRequests(ownerOpenId: string) {
  await ensureConnected();
  return PrayerRequest.find({ ownerOpenId }).sort({ createdAt: -1 }).lean();
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

export async function getDonationById(id: string) {
  await ensureConnected();
  return Donation.findById(id).lean();
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

function hashCameraInvite(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export async function createProductionCameraInvitation(input: {
  sessionId: string;
  label: string;
  createdByOpenId: string;
  expiresAt: Date;
}) {
  await ensureConnected();
  const code = randomBytes(32).toString("base64url");
  const invitation = await ProductionCameraInvitation.create({
    sessionId: input.sessionId,
    label: input.label.trim(),
    codeHash: hashCameraInvite(code),
    status: "pending",
    expiresAt: input.expiresAt,
    createdByOpenId: input.createdByOpenId,
  });
  return { invitation, code };
}

export async function listProductionCameraInvitations(sessionId: string) {
  await ensureConnected();
  return ProductionCameraInvitation.find({ sessionId }).select("-codeHash").sort({ createdAt: -1 }).lean();
}

export async function revokeProductionCameraInvitation(invitationId: string, sessionId: string) {
  await ensureConnected();
  return ProductionCameraInvitation.findOneAndUpdate(
    { _id: invitationId, sessionId, status: { $in: ["pending", "accepted"] } },
    { $set: { status: "revoked", updatedAt: new Date() } },
    { new: true }
  ).lean();
}

export async function acceptProductionCameraInvitation(input: {
  sessionId: string;
  code: string;
  deviceName: string;
}) {
  await ensureConnected();
  const invitation = await ProductionCameraInvitation.findOne({ sessionId: input.sessionId, codeHash: hashCameraInvite(input.code) });
  if (!invitation) return null;
  const now = new Date();
  if (invitation.status === "revoked" || invitation.status === "expired" || invitation.expiresAt.getTime() <= now.getTime()) {
    if (invitation.status !== "expired") {
      invitation.status = "expired";
      await invitation.save();
    }
    return null;
  }
  invitation.status = "accepted";
  invitation.acceptedAt = invitation.acceptedAt ?? now;
  invitation.acceptedDeviceName = input.deviceName.trim().slice(0, 80);
  invitation.lastSeenAt = now;
  await invitation.save();
  return invitation.toObject();
}

export async function touchProductionCameraInvitation(invitationId: string, sessionId: string) {
  await ensureConnected();
  return ProductionCameraInvitation.findOneAndUpdate(
    { _id: invitationId, sessionId, status: "accepted", expiresAt: { $gt: new Date() } },
    { $set: { lastSeenAt: new Date() } },
    { new: true }
  ).lean();
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


// ---- Spiritual Journey & Faith Journal ----
export async function getSpiritualJourneys(userOpenId: string) {
  await ensureConnected();
  return SpiritualJourney.find({ userOpenId }).sort({ updatedAt: -1 }).lean();
}

export async function upsertSpiritualJourney(data: {
  userOpenId: string;
  pathId: string;
  pathTitle: string;
  currentStep?: number;
  completedSteps?: number[];
  welcomeAnswers?: Record<string, string>;
}) {
  await ensureConnected();
  return SpiritualJourney.findOneAndUpdate(
    { userOpenId: data.userOpenId, pathId: data.pathId },
    {
      $set: {
        pathTitle: data.pathTitle,
        ...(data.currentStep !== undefined ? { currentStep: data.currentStep } : {}),
        ...(data.completedSteps ? { completedSteps: data.completedSteps } : {}),
        ...(data.welcomeAnswers ? { welcomeAnswers: data.welcomeAnswers } : {}),
        updatedAt: new Date(),
      },
      $setOnInsert: { userOpenId: data.userOpenId, pathId: data.pathId },
    },
    { upsert: true, new: true }
  ).lean();
}

export async function getFaithJournalEntries(userOpenId: string) {
  await ensureConnected();
  return FaithJournalEntry.find({ userOpenId }).sort({ createdAt: -1 }).lean();
}

export async function createFaithJournalEntry(data: {
  userOpenId: string;
  title?: string;
  content: string;
  mood?: "grateful" | "hopeful" | "burdened" | "peaceful" | "seeking";
  scriptureReference?: string;
}) {
  await ensureConnected();
  return FaithJournalEntry.create({
    userOpenId: data.userOpenId,
    title: data.title ?? null,
    content: data.content,
    mood: data.mood ?? null,
    scriptureReference: data.scriptureReference ?? null,
    isPrivate: true,
  });
}

export async function deleteFaithJournalEntry(userOpenId: string, id: string) {
  await ensureConnected();
  return FaithJournalEntry.findOneAndDelete({ _id: id, userOpenId }).lean();
}


// ---- Trusted Circles & Pastoral Care ----
export async function getActiveCircles() {
  await ensureConnected();
  const existing = await Circle.find({ isActive: true }).sort({ createdAt: -1 }).lean();
  if (existing.length > 0) return existing;
  await Circle.insertMany([
    { name: "Wednesday Prayer Circle", description: "A gentle midweek space to pray, listen, and carry one another before God.", category: "prayer", meetingDetails: "Wednesdays at 7:00 PM · Church Hall", isActive: true },
    { name: "Foundations of Faith", description: "A six-week small group for people beginning or renewing their walk with Christ.", category: "small-group", meetingDetails: "Six-week journey · Small group room", isActive: true },
    { name: "Young People in Purpose", description: "A safe community for young people to ask honest questions, grow, and serve.", category: "youth", meetingDetails: "Saturdays at 3:00 PM · Community Center", isActive: true },
    { name: "Faith in Action", description: "A service circle connecting prayer with practical care for our neighbours.", category: "service", meetingDetails: "Monthly outreach · Meet at the parish", isActive: true },
  ]);
  return Circle.find({ isActive: true }).sort({ createdAt: -1 }).lean();
}

export async function getUserCircleMemberships(userOpenId: string) {
  await ensureConnected();
  return CircleMembership.find({ userOpenId, status: { $ne: "left" } }).sort({ createdAt: -1 }).lean();
}

export async function requestCircleMembership(circleId: string, userOpenId: string) {
  await ensureConnected();
  const circle = await Circle.findOne({ _id: circleId, isActive: true }).lean();
  if (!circle) throw new Error("This circle is not available");
  return CircleMembership.findOneAndUpdate(
    { circleId, userOpenId },
    { $set: { status: "requested", updatedAt: new Date() }, $setOnInsert: { circleId, userOpenId } },
    { upsert: true, new: true }
  ).lean();
}

export async function getCircleById(circleId: string) {
  await ensureConnected();
  return Circle.findById(circleId).lean();
}

export async function getManagedCircles(userOpenId: string) {
  await ensureConnected();
  return Circle.find({ leaderOpenId: userOpenId, isActive: true }).sort({ createdAt: -1 }).lean();
}

export async function getCircleMembershipRequests(circleId?: string) {
  await ensureConnected();
  const filter = circleId ? { circleId, status: "requested" as const } : { status: "requested" as const };
  const requests = await CircleMembership.find(filter).sort({ createdAt: 1 }).lean();
  const circleIds = Array.from(new Set(requests.map(request => request.circleId)));
  const userIds = Array.from(new Set(requests.map(request => request.userOpenId)));
  const [circles, users] = await Promise.all([
    Circle.find({ _id: { $in: circleIds } }).select("name category leaderOpenId").lean(),
    User.find({ openId: { $in: userIds } }).select("openId name email").lean(),
  ]);
  const circleById = new Map(circles.map(circle => [String(circle._id), circle]));
  const userByOpenId = new Map(users.map(user => [user.openId, user]));
  return requests.map(request => ({
    ...request,
    circle: circleById.get(request.circleId) ?? null,
    user: userByOpenId.get(request.userOpenId) ?? null,
  }));
}

export async function updateCircleMembershipStatus(
  membershipId: string,
  status: "active" | "left"
) {
  await ensureConnected();
  return CircleMembership.findByIdAndUpdate(
    membershipId,
    { status, updatedAt: new Date() },
    { new: true }
  ).lean();
}

export async function createCircle(data: {
  name: string;
  description: string;
  category: "small-group" | "prayer" | "youth" | "service" | "family";
  meetingDetails?: string;
  leaderOpenId?: string;
}) {
  await ensureConnected();
  return Circle.create({
    ...data,
    meetingDetails: data.meetingDetails ?? null,
    leaderOpenId: data.leaderOpenId ?? null,
    isActive: true,
  });
}

export async function updateCircle(circleId: string, data: Partial<{
  name: string;
  description: string;
  category: "small-group" | "prayer" | "youth" | "service" | "family";
  meetingDetails: string;
  leaderOpenId: string | null;
  isActive: boolean;
}>) {
  await ensureConnected();
  return Circle.findByIdAndUpdate(circleId, { ...data, updatedAt: new Date() }, { new: true }).lean();
}

export async function createCareRequest(data: {
  userOpenId: string;
  category: "pastoral-conversation" | "grief" | "family" | "youth" | "addiction" | "practical-help" | "other";
  message: string;
  preferredContact?: "email" | "phone" | "in-person";
  safeguardingFlag?: boolean;
}) {
  await ensureConnected();
  const careRequest = await CareRequest.create({
    ...data,
    safeguardingFlag: data.safeguardingFlag ?? false,
    status: data.safeguardingFlag ? "escalated" : "new",
    priority: data.safeguardingFlag ? "urgent" : "routine",
    dueAt: data.safeguardingFlag ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
  });
  await CareCaseActivity.create({
    careRequestId: careRequest._id.toString(),
    actorOpenId: data.userOpenId,
    action: "created",
    summary: data.safeguardingFlag ? "Safeguarding-sensitive request received" : "Care request received",
  });
  return careRequest;
}

export async function getUserCareRequests(userOpenId: string) {
  await ensureConnected();
  return CareRequest.find({ userOpenId }).sort({ createdAt: -1 }).lean();
}

export async function getCareRequests() {
  await ensureConnected();
  return CareRequest.find({}).sort({ safeguardingFlag: -1, priority: -1, dueAt: 1, createdAt: -1 }).lean();
}

export async function getCareCaseNotes(careRequestId: string) {
  await ensureConnected();
  return CareCaseNote.find({ careRequestId }).sort({ createdAt: 1 }).lean();
}

export async function getCareCaseActivity(careRequestId: string) {
  await ensureConnected();
  return CareCaseActivity.find({ careRequestId }).sort({ createdAt: 1 }).lean();
}

export async function addCareCaseNote(data: { careRequestId: string; authorOpenId: string; content: string }) {
  await ensureConnected();
  const careRequest = await CareRequest.findById(data.careRequestId).lean();
  if (!careRequest) throw new Error("Care request not found");
  const note = await CareCaseNote.create(data);
  await CareRequest.findByIdAndUpdate(data.careRequestId, { lastRespondedAt: new Date(), updatedAt: new Date() });
  await CareCaseActivity.create({
    careRequestId: data.careRequestId,
    actorOpenId: data.authorOpenId,
    action: "note_added",
    summary: "Private case note added",
  });
  return note;
}

export async function assignCareRequest(data: { id: string; assignedToOpenId: string | null; actorOpenId: string }) {
  await ensureConnected();
  const result = await CareRequest.findByIdAndUpdate(
    data.id,
    { assignedToOpenId: data.assignedToOpenId, status: data.assignedToOpenId ? "assigned" : "new", updatedAt: new Date() },
    { new: true }
  ).lean();
  if (!result) return null;
  await CareCaseActivity.create({
    careRequestId: data.id,
    actorOpenId: data.actorOpenId,
    action: "assigned",
    summary: data.assignedToOpenId ? "Case assigned to a care team member" : "Case assignment cleared",
  });
  return result;
}

export async function updateCareRequestCase(data: {
  id: string;
  actorOpenId: string;
  status?: "new" | "assigned" | "in-progress" | "closed" | "escalated";
  priority?: "routine" | "high" | "urgent";
  dueAt?: Date | null;
}) {
  await ensureConnected();
  const existing = await CareRequest.findById(data.id).lean() as any;
  if (!existing) return null;
  const { id, actorOpenId, ...updates } = data;
  const result = await CareRequest.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
  const activities: Array<{ action: "status_changed" | "priority_changed" | "deadline_changed"; summary: string }> = [];
  if (updates.status !== undefined && updates.status !== existing.status) activities.push({ action: "status_changed", summary: `Case status changed to ${updates.status}` });
  if (updates.priority !== undefined && updates.priority !== existing.priority) activities.push({ action: "priority_changed", summary: `Case priority changed to ${updates.priority}` });
  if (updates.dueAt !== undefined && String(updates.dueAt) !== String(existing.dueAt)) activities.push({ action: "deadline_changed", summary: updates.dueAt ? "Case response deadline updated" : "Case response deadline cleared" });
  if (activities.length) await CareCaseActivity.insertMany(activities.map(activity => ({ careRequestId: id, actorOpenId, ...activity })));
  return result;
}

export async function updateCareRequestStatus(id: string, status: "new" | "assigned" | "in-progress" | "closed" | "escalated") {
  await ensureConnected();
  return CareRequest.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
}


// ---- Faith in Action ----
export async function getActiveServiceOpportunities() {
  await ensureConnected();
  const existing = await ServiceOpportunity.find({ isActive: true }).sort({ startsAt: 1, createdAt: -1 }).lean();
  if (existing.length > 0) return existing;
  await ServiceOpportunity.insertMany([
    { title: "Visit and Encourage Elders", description: "Spend time listening, praying, and bringing companionship to older members of our community.", category: "visitation", location: "Kibugu community", startsAt: new Date(Date.now() + 14 * 86400000), spots: 12, isActive: true },
    { title: "Student Support Afternoon", description: "Help students with reading, mentoring, and practical encouragement.", category: "students", location: "Community Center", startsAt: new Date(Date.now() + 21 * 86400000), spots: 10, isActive: true },
    { title: "Parish Clean and Care Day", description: "Serve together by caring for the church grounds and surrounding community spaces.", category: "environment", location: "NICA Kibugu Parish", startsAt: new Date(Date.now() + 28 * 86400000), spots: 30, isActive: true },
  ]);
  return ServiceOpportunity.find({ isActive: true }).sort({ startsAt: 1, createdAt: -1 }).lean();
}

export async function getUserServiceSignups(userOpenId: string) {
  await ensureConnected();
  return ServiceSignup.find({ userOpenId, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).lean();
}

export async function signupForService(opportunityId: string, userOpenId: string) {
  await ensureConnected();
  const opportunity = await ServiceOpportunity.findOne({ _id: opportunityId, isActive: true }).lean() as any;
  if (!opportunity) throw new Error("This service opportunity is not available");
  const existing = await ServiceSignup.findOne({ opportunityId, userOpenId }).lean() as any;
  if (existing && existing.status !== "cancelled") return existing;
  const signupCount = await ServiceSignup.countDocuments({ opportunityId, status: { $ne: "cancelled" } });
  if (opportunity.spots > 0 && signupCount >= opportunity.spots) throw new Error("This service opportunity is full");
  return ServiceSignup.findOneAndUpdate(
    { opportunityId, userOpenId },
    { $set: { status: "interested", updatedAt: new Date() }, $setOnInsert: { opportunityId, userOpenId } },
    { upsert: true, new: true }
  ).lean();
}

export async function getAllServiceOpportunities() {
  await ensureConnected();
  return ServiceOpportunity.find({}).sort({ startsAt: 1, createdAt: -1 }).lean();
}

export async function createServiceOpportunity(data: {
  title: string;
  description: string;
  category: "visitation" | "students" | "food" | "environment" | "skills" | "outreach" | "other";
  location?: string;
  startsAt?: Date;
  spots: number;
}) {
  await ensureConnected();
  return ServiceOpportunity.create({ ...data, location: data.location ?? null, startsAt: data.startsAt ?? null, isActive: true });
}

export async function updateServiceOpportunity(id: string, data: Partial<{
  title: string;
  description: string;
  category: "visitation" | "students" | "food" | "environment" | "skills" | "outreach" | "other";
  location: string | null;
  startsAt: Date | null;
  spots: number;
  isActive: boolean;
}>) {
  await ensureConnected();
  return ServiceOpportunity.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true }).lean();
}

export async function getServiceSignups() {
  await ensureConnected();
  const signups = await ServiceSignup.find({}).sort({ createdAt: -1 }).lean();
  const opportunityIds = Array.from(new Set(signups.map(signup => signup.opportunityId)));
  const userIds = Array.from(new Set(signups.map(signup => signup.userOpenId)));
  const [opportunities, users] = await Promise.all([
    ServiceOpportunity.find({ _id: { $in: opportunityIds } }).select("title category startsAt").lean(),
    User.find({ openId: { $in: userIds } }).select("openId name email").lean(),
  ]);
  const opportunityById = new Map(opportunities.map(opportunity => [String(opportunity._id), opportunity]));
  const userByOpenId = new Map(users.map(user => [user.openId, user]));
  return signups.map(signup => ({ ...signup, opportunity: opportunityById.get(signup.opportunityId) ?? null, user: userByOpenId.get(signup.userOpenId) ?? null }));
}

export async function updateServiceSignupStatus(id: string, status: "interested" | "confirmed" | "cancelled") {
  await ensureConnected();
  return ServiceSignup.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
}


// ---- Prayer Room Sessions ----
export async function getAllPrayerRoomSessions() {
  await ensureConnected();
  return PrayerRoomSession.find({}).sort({ startsAt: 1, createdAt: -1 }).lean();
}

export async function createPrayerRoomSession(data: {
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  mode: "voice-video" | "voice";
  capacity: number;
  joinUrl?: string;
  isPublished: boolean;
}) {
  await ensureConnected();
  return PrayerRoomSession.create({ ...data, joinUrl: data.joinUrl ?? null, status: "scheduled" });
}

export async function updatePrayerRoomSession(id: string, data: Partial<{
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  mode: "voice-video" | "voice";
  capacity: number;
  joinUrl: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  isPublished: boolean;
}>) {
  await ensureConnected();
  return PrayerRoomSession.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true }).lean();
}

export async function getUpcomingPrayerRoomSessions() {
  await ensureConnected();
  const now = new Date();
  const existing = await PrayerRoomSession.find({ isPublished: true, $or: [{ status: "scheduled", startsAt: { $gte: now } }, { status: "live", startsAt: { $lte: now } }] }).sort({ startsAt: 1 }).lean();
  if (existing.length > 0) return existing.map(session => ({ ...session, joinUrl: null }));
  await PrayerRoomSession.create({
    title: "Stories of Grace: A Prayer Room Gathering",
    description: "A moderated online room to share how God is meeting us, listen without fixing, and pray for one another.",
    startsAt: new Date(Date.now() + 7 * 86400000),
    durationMinutes: 60,
    mode: "voice-video",
    capacity: 30,
    status: "scheduled",
    isPublished: true,
  });
  const sessions = await PrayerRoomSession.find({ isPublished: true, $or: [{ status: "scheduled", startsAt: { $gte: new Date() } }, { status: "live", startsAt: { $lte: new Date() } }] }).sort({ startsAt: 1 }).lean();
  return sessions.map(session => ({ ...session, joinUrl: null }));
}

export async function getPrayerRoomSessionStatus(sessionId: string, userOpenId: string) {
  await ensureConnected();
  const user = await User.findOne({ openId: userOpenId }).select("openId role").lean() as any;
  const registration = await PrayerRoomRegistration.findOne({ sessionId, userOpenId, status: { $in: ["registered", "attended"] } }).lean();
  if (user?.role !== "admin" && !registration) throw new Error("Register for this gathering before viewing its status");
  const session = await PrayerRoomSession.findById(sessionId).select("_id title status startsAt durationMinutes mode").lean() as any;
  if (!session) throw new Error("Prayer Room session not found");
  return { sessionId: String(session._id), title: session.title, status: session.status, startsAt: session.startsAt, durationMinutes: session.durationMinutes, mode: session.mode };
}

export async function authorizePrayerRoomParticipant(sessionId: string, userOpenId: string) {
  await ensureConnected();
  const user = await User.findOne({ openId: userOpenId }).select("openId role").lean() as any;
  const registration = await PrayerRoomRegistration.findOne({ sessionId, userOpenId, status: { $in: ["registered", "attended"] } }).lean();
  if (user?.role !== "admin" && !registration) throw new Error("Register for this gathering before joining");
  const session = await PrayerRoomSession.findOne({ _id: sessionId, isPublished: true, status: "live" }).lean() as any;
  if (!session) throw new Error("The host has not opened the secure room yet");
  return { sessionId: String(session._id), title: session.title, mode: session.mode, joinUrl: session.joinUrl ?? null, role: user?.role === "admin" ? "admin" as const : "user" as const };
}

export async function getRegisteredPrayerRoomJoin(sessionId: string, userOpenId: string) {
  const session = await authorizePrayerRoomParticipant(sessionId, userOpenId);
  return { ...session, internalRoom: !session.joinUrl };
}

export async function getUserPrayerRoomRegistrations(userOpenId: string) {
  await ensureConnected();
  return PrayerRoomRegistration.find({ userOpenId, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).lean();
}

export async function registerForPrayerRoom(data: { sessionId: string; userOpenId: string; notificationOptIn: boolean }) {
  await ensureConnected();
  const session = await PrayerRoomSession.findById(data.sessionId).lean() as any;
  if (!session || session.status !== "scheduled" || !session.isPublished) throw new Error("This Prayer Room session is no longer available");
  const existing = await PrayerRoomRegistration.findOne({ sessionId: data.sessionId, userOpenId: data.userOpenId }).lean() as any;
  if (existing && existing.status !== "cancelled") return existing;
  const registrations = await PrayerRoomRegistration.countDocuments({ sessionId: data.sessionId, status: { $ne: "cancelled" } });
  if (session.capacity > 0 && registrations >= session.capacity) throw new Error("This Prayer Room session is full");
  return PrayerRoomRegistration.findOneAndUpdate(
    { sessionId: data.sessionId, userOpenId: data.userOpenId },
    { $set: { notificationOptIn: data.notificationOptIn, status: "registered", updatedAt: new Date() }, $setOnInsert: { sessionId: data.sessionId, userOpenId: data.userOpenId } },
    { upsert: true, new: true }
  ).lean();
}

export async function getNotificationPreferences(userOpenId: string) {
  await ensureConnected();
  return NotificationPreference.findOneAndUpdate(
    { userOpenId },
    { $setOnInsert: { userOpenId } },
    { upsert: true, new: true }
  ).lean();
}

export async function updateNotificationPreferences(data: {
  userOpenId: string;
  browserNotifications?: boolean;
  prayerRoom?: boolean;
  sermons?: boolean;
  events?: boolean;
  email?: boolean;
}) {
  await ensureConnected();
  const { userOpenId, ...updates } = data;
  return NotificationPreference.findOneAndUpdate(
    { userOpenId },
    { $set: updates, $setOnInsert: { userOpenId } },
    { upsert: true, new: true }
  ).lean();
}

export async function getUpcomingPrayerRoomReminderRecipients(minutesBefore = 15, windowMinutes = 5) {
  await ensureConnected();
  const now = Date.now();
  const from = new Date(now + minutesBefore * 60_000);
  const to = new Date(now + (minutesBefore + windowMinutes) * 60_000);
  const sessions = await PrayerRoomSession.find({ isPublished: true, status: "scheduled", startsAt: { $gte: from, $lt: to } }).select("_id title description startsAt durationMinutes mode").lean();
  if (!sessions.length) return [];
  const sessionIds = sessions.map(session => String(session._id));
  const registrations = await PrayerRoomRegistration.find({ sessionId: { $in: sessionIds }, status: "registered", notificationOptIn: true }).lean();
  if (!registrations.length) return [];
  const userIds = Array.from(new Set(registrations.map(registration => registration.userOpenId)));
  const [preferences, users] = await Promise.all([
    NotificationPreference.find({ userOpenId: { $in: userIds }, prayerRoom: true, email: true }).lean(),
    User.find({ openId: { $in: userIds } }).select("openId name email").lean(),
  ]);
  const allowedUsers = new Set(preferences.map(preference => preference.userOpenId));
  const userById = new Map(users.map(user => [user.openId, user]));
  const sessionById = new Map(sessions.map(session => [String(session._id), session]));
  return registrations
    .filter(registration => allowedUsers.has(registration.userOpenId) && userById.get(registration.userOpenId)?.email)
    .map(registration => ({
      registration,
      user: userById.get(registration.userOpenId)!,
      session: sessionById.get(registration.sessionId)!,
      dedupeKey: `prayer-room:${registration.sessionId}:${registration.userOpenId}:${minutesBefore}m`,
    }));
}

export async function claimNotificationDelivery(data: { dedupeKey: string; userOpenId: string; kind: "prayer-room" | "sermon" | "event"; channel: "email" | "webhook" }) {
  await ensureConnected();
  try {
    return await NotificationDelivery.create({ ...data, status: "processing", attempts: 1 });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const existing = await NotificationDelivery.findOne({ dedupeKey: data.dedupeKey }).lean() as any;
    if (!existing || existing.status === "sent" || existing.status === "processing") return null;
    return NotificationDelivery.findOneAndUpdate(
      { dedupeKey: data.dedupeKey, status: "failed" },
      { $set: { status: "processing", lastError: null, updatedAt: new Date() }, $inc: { attempts: 1 } },
      { new: true }
    ).lean();
  }
}

export async function finishNotificationDelivery(dedupeKey: string, result: { status: "sent" | "failed"; error?: string }) {
  await ensureConnected();
  return NotificationDelivery.findOneAndUpdate(
    { dedupeKey },
    { $set: { status: result.status, sentAt: result.status === "sent" ? new Date() : null, lastError: result.error ?? null, updatedAt: new Date() } },
    { new: true }
  ).lean();
}
