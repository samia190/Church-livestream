import mongoose, { Schema, Document, model } from "mongoose";

// ---- User ----
export interface IUser extends Document {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

const UserSchema = new Schema<IUser>(
  {
    openId: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
    loginMethod: { type: String, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastSignedIn: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

export const User = mongoose.models.User || model<IUser>("User", UserSchema);

// ---- PrayerRequest ----
export interface IPrayerRequest extends Document {
  name: string;
  email: string;
  ownerOpenId?: string | null;
  prayerRequest: string;
  isPublic: boolean;
  status: "pending" | "approved" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const PrayerRequestSchema = new Schema<IPrayerRequest>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    ownerOpenId: { type: String, default: null, index: true },
    prayerRequest: { type: String, required: true },
    isPublic: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "approved", "archived"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "prayerRequests",
  }
);

export const PrayerRequest =
  mongoose.models.PrayerRequest ||
  model<IPrayerRequest>("PrayerRequest", PrayerRequestSchema);

// ---- Donation ----
export interface IDonation extends Document {
  donorName: string;
  email: string;
  phone?: string | null;
  amount: number;
  currency: string;
  method: "online" | "bank" | "mobile" | "inperson";
  provider?: "mpesa" | "paypal" | null;
  purpose?: string | null;
  status: "pending" | "completed" | "failed";
  transactionId?: string | null;
  providerReference?: string | null;
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    donorName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "KES" },
    method: {
      type: String,
      enum: ["online", "bank", "mobile", "inperson"],
      required: true,
    },
    provider: { type: String, enum: ["mpesa", "paypal"], default: null },
    purpose: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    transactionId: { type: String, default: null },
    providerReference: { type: String, default: null, index: true },
    idempotencyKey: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    collection: "donations",
  }
);

export const Donation =
  mongoose.models.Donation || model<IDonation>("Donation", DonationSchema);

// ---- ContactMessage ----
export interface IContactMessage extends Document {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  status: "new" | "read" | "responded";
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "read", "responded"],
      default: "new",
    },
  },
  {
    timestamps: true,
    collection: "contactMessages",
  }
);

export const ContactMessage =
  mongoose.models.ContactMessage ||
  model<IContactMessage>("ContactMessage", ContactMessageSchema);

// ---- Event ----
export interface IEvent extends Document {
  title: string;
  description?: string | null;
  eventType: "service" | "event" | "crusade" | "meeting" | "other";
  startDate: Date;
  endDate?: Date | null;
  location?: string | null;
  imageUrl?: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    eventType: {
      type: String,
      enum: ["service", "event", "crusade", "meeting", "other"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    location: { type: String, default: null },
    imageUrl: { type: String, default: null },
    isPublished: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "events",
  }
);

export const Event =
  mongoose.models.Event || model<IEvent>("Event", EventSchema);

// ---- Sermon ----
export interface ISermon extends Document {
  title: string;
  speaker?: string | null;
  description?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  sermonDate: Date;
  duration?: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SermonSchema = new Schema<ISermon>(
  {
    title: { type: String, required: true },
    speaker: { type: String, default: null },
    description: { type: String, default: null },
    videoUrl: { type: String, default: null },
    audioUrl: { type: String, default: null },
    sermonDate: { type: Date, required: true },
    duration: { type: Number, default: null },
    isPublished: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "sermons",
  }
);

export const Sermon =
  mongoose.models.Sermon || model<ISermon>("Sermon", SermonSchema);

// ---- AdminSetting ----
export interface IAdminSetting extends Document {
  key: string;
  value?: string | null;
  description?: string | null;
  updatedAt: Date;
}

const AdminSettingSchema = new Schema<IAdminSetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, default: null },
    description: { type: String, default: null },
  },
  {
    timestamps: false,
    collection: "adminSettings",
  }
);

AdminSettingSchema.pre("save", function () {
  this.updatedAt = new Date();
});

export const AdminSetting =
  mongoose.models.AdminSetting ||
  model<IAdminSetting>("AdminSetting", AdminSettingSchema);

// ---- StreamingSession ----
export interface IStreamingSession extends Document {
  title: string;
  description?: string | null;
  status: "scheduled" | "live" | "ended" | "archived";
  startTime: Date;
  endTime?: Date | null;
  streamKey?: string | null;
  rtmpUrl?: string | null;
  isPublished: boolean;
  recordingUrl?: string | null;
  viewerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const StreamingSessionSchema = new Schema<IStreamingSession>(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended", "archived"],
      default: "scheduled",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    streamKey: { type: String, default: null }, // Removed unique constraint — multiple sessions can have null streamKey
    rtmpUrl: { type: String, default: null },
    isPublished: { type: Boolean, default: false },
    recordingUrl: { type: String, default: null },
    viewerCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "streamingSessions",
  }
);

export const StreamingSession =
  mongoose.models.StreamingSession ||
  model<IStreamingSession>("StreamingSession", StreamingSessionSchema);

// ---- ProductionCameraInvitation ----
export interface IProductionCameraInvitation extends Document {
  sessionId: string;
  label: string;
  codeHash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: Date;
  createdByOpenId: string;
  acceptedAt?: Date | null;
  acceptedDeviceName?: string | null;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProductionCameraInvitationSchema = new Schema<IProductionCameraInvitation>(
  {
    sessionId: { type: String, required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    codeHash: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "revoked", "expired"], default: "pending", index: true },
    expiresAt: { type: Date, required: true, index: true },
    createdByOpenId: { type: String, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedDeviceName: { type: String, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "productionCameraInvitations" }
);

ProductionCameraInvitationSchema.index({ sessionId: 1, status: 1 });
export const ProductionCameraInvitation =
  mongoose.models.ProductionCameraInvitation ||
  model<IProductionCameraInvitation>("ProductionCameraInvitation", ProductionCameraInvitationSchema);

// ---- PlatformConnection ----
export interface IPlatformConnection extends Document {
  platform:
    | "youtube"
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "twitch";
  accountName: string;
  accessToken: string;
  refreshToken?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformConnectionSchema = new Schema<IPlatformConnection>(
  {
    platform: {
      type: String,
      enum: ["youtube", "facebook", "instagram", "tiktok", "twitter", "twitch"],
      required: true,
    },
    accountName: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "platformConnections",
  }
);

export const PlatformConnection =
  mongoose.models.PlatformConnection ||
  model<IPlatformConnection>("PlatformConnection", PlatformConnectionSchema);

// ---- CameraDevice ----
export interface ICameraDevice extends Document {
  name: string;
  deviceId: string;
  type: "webcam" | "external" | "phone" | "other";
  status: "available" | "in_use" | "offline";
  resolution?: string | null;
  frameRate?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CameraDeviceSchema = new Schema<ICameraDevice>(
  {
    name: { type: String, required: true },
    deviceId: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["webcam", "external", "phone", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "in_use", "offline"],
      default: "available",
    },
    resolution: { type: String, default: null },
    frameRate: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "cameraDevices",
  }
);

export const CameraDevice =
  mongoose.models.CameraDevice ||
  model<ICameraDevice>("CameraDevice", CameraDeviceSchema);

// ---- StreamBroadcast ----
export interface IStreamBroadcast extends Document {
  sessionId: mongoose.Types.ObjectId; // ObjectId of StreamingSession
  platform:
    | "youtube"
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "twitch";
  broadcastUrl?: string | null;
  status: "pending" | "live" | "ended";
  viewerCount: number;
  startTime?: Date | null;
  endTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StreamBroadcastSchema = new Schema<IStreamBroadcast>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "StreamingSession",
      required: true,
    },
    platform: {
      type: String,
      enum: ["youtube", "facebook", "instagram", "tiktok", "twitter", "twitch"],
      required: true,
    },
    broadcastUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "live", "ended"],
      default: "pending",
    },
    viewerCount: { type: Number, default: 0 },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "streamBroadcasts",
  }
);

export const StreamBroadcast =
  mongoose.models.StreamBroadcast ||
  model<IStreamBroadcast>("StreamBroadcast", StreamBroadcastSchema);

// ---- PlatformCredential ----
export interface IPlatformCredential extends Document {
  platform:
    | "youtube"
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "twitch"
    | "restream";
  streamKey?: string | null;
  streamUrl?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  isActive: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformCredentialSchema = new Schema<IPlatformCredential>(
  {
    platform: {
      type: String,
      enum: [
        "youtube",
        "facebook",
        "instagram",
        "tiktok",
        "twitter",
        "twitch",
        "restream",
      ],
      required: true,
    },
    streamKey: { type: String, default: null },
    streamUrl: { type: String, default: null },
    apiKey: { type: String, default: null },
    apiSecret: { type: String, default: null },
    accessToken: { type: String, default: null },
    refreshToken: { type: String, default: null },
    accountId: { type: String, default: null },
    accountName: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "platformCredentials",
  }
);

export const PlatformCredential =
  mongoose.models.PlatformCredential ||
  model<IPlatformCredential>("PlatformCredential", PlatformCredentialSchema);

// ---- SessionPlatformMap ----
export interface ISessionPlatformMap extends Document {
  sessionId: mongoose.Types.ObjectId; // ObjectId of StreamingSession
  platform:
    | "youtube"
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "twitch";
  broadcastId?: string | null;
  broadcastUrl?: string | null;
  status: "pending" | "live" | "ended" | "failed";
  viewerCount: number;
  startTime?: Date | null;
  endTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SessionPlatformMapSchema = new Schema<ISessionPlatformMap>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "StreamingSession",
      required: true,
    },
    platform: {
      type: String,
      enum: ["youtube", "facebook", "instagram", "tiktok", "twitter", "twitch"],
      required: true,
    },
    broadcastId: { type: String, default: null },
    broadcastUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "live", "ended", "failed"],
      default: "pending",
    },
    viewerCount: { type: Number, default: 0 },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "sessionPlatformMap",
  }
);

export const SessionPlatformMap =
  mongoose.models.SessionPlatformMap ||
  model<ISessionPlatformMap>("SessionPlatformMap", SessionPlatformMapSchema);


// ---- Spiritual Journey ----
export interface ISpiritualJourney extends Document {
  userOpenId: string;
  pathId: string;
  pathTitle: string;
  currentStep: number;
  completedSteps: number[];
  welcomeAnswers: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const SpiritualJourneySchema = new Schema<ISpiritualJourney>(
  {
    userOpenId: { type: String, required: true, index: true },
    pathId: { type: String, required: true },
    pathTitle: { type: String, required: true },
    currentStep: { type: Number, default: 0 },
    completedSteps: { type: [Number], default: [] },
    welcomeAnswers: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "spiritualJourneys" }
);

SpiritualJourneySchema.index({ userOpenId: 1, pathId: 1 }, { unique: true });
export const SpiritualJourney = mongoose.models.SpiritualJourney || model<ISpiritualJourney>("SpiritualJourney", SpiritualJourneySchema);

// ---- Faith Journal ----
export interface IFaithJournalEntry extends Document {
  userOpenId: string;
  title?: string | null;
  content: string;
  mood?: "grateful" | "hopeful" | "burdened" | "peaceful" | "seeking" | null;
  scriptureReference?: string | null;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FaithJournalEntrySchema = new Schema<IFaithJournalEntry>(
  {
    userOpenId: { type: String, required: true, index: true },
    title: { type: String, default: null },
    content: { type: String, required: true, maxlength: 12000 },
    mood: { type: String, enum: ["grateful", "hopeful", "burdened", "peaceful", "seeking"], default: null },
    scriptureReference: { type: String, default: null },
    isPrivate: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "faithJournalEntries" }
);

FaithJournalEntrySchema.index({ userOpenId: 1, createdAt: -1 });
export const FaithJournalEntry = mongoose.models.FaithJournalEntry || model<IFaithJournalEntry>("FaithJournalEntry", FaithJournalEntrySchema);


// ---- Trusted Circles ----
export interface ICircle extends Document {
  name: string;
  description: string;
  category: "small-group" | "prayer" | "youth" | "service" | "family";
  meetingDetails?: string | null;
  leaderOpenId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CircleSchema = new Schema<ICircle>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: ["small-group", "prayer", "youth", "service", "family"], required: true },
    meetingDetails: { type: String, default: null },
    leaderOpenId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "circles" }
);

export const Circle = mongoose.models.Circle || model<ICircle>("Circle", CircleSchema);

export interface ICircleMembership extends Document {
  circleId: string;
  userOpenId: string;
  status: "requested" | "active" | "left";
  createdAt: Date;
  updatedAt: Date;
}

const CircleMembershipSchema = new Schema<ICircleMembership>(
  {
    circleId: { type: String, required: true, index: true },
    userOpenId: { type: String, required: true, index: true },
    status: { type: String, enum: ["requested", "active", "left"], default: "requested" },
  },
  { timestamps: true, collection: "circleMemberships" }
);

CircleMembershipSchema.index({ circleId: 1, userOpenId: 1 }, { unique: true });
export const CircleMembership = mongoose.models.CircleMembership || model<ICircleMembership>("CircleMembership", CircleMembershipSchema);

// ---- Pastoral Care ----
export interface ICareRequest extends Document {
  userOpenId: string;
  category: "pastoral-conversation" | "grief" | "family" | "youth" | "addiction" | "practical-help" | "other";
  message: string;
  preferredContact?: "email" | "phone" | "in-person" | null;
  status: "new" | "assigned" | "in-progress" | "closed" | "escalated";
  safeguardingFlag: boolean;
  assignedToOpenId?: string | null;
  priority: "routine" | "high" | "urgent";
  dueAt?: Date | null;
  lastRespondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CareRequestSchema = new Schema<ICareRequest>(
  {
    userOpenId: { type: String, required: true, index: true },
    category: { type: String, enum: ["pastoral-conversation", "grief", "family", "youth", "addiction", "practical-help", "other"], required: true },
    message: { type: String, required: true, maxlength: 12000 },
    preferredContact: { type: String, enum: ["email", "phone", "in-person"], default: null },
    status: { type: String, enum: ["new", "assigned", "in-progress", "closed", "escalated"], default: "new" },
    safeguardingFlag: { type: Boolean, default: false },
    assignedToOpenId: { type: String, default: null, index: true },
    priority: { type: String, enum: ["routine", "high", "urgent"], default: "routine", index: true },
    dueAt: { type: Date, default: null, index: true },
    lastRespondedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "careRequests" }
);

export const CareRequest = mongoose.models.CareRequest || model<ICareRequest>("CareRequest", CareRequestSchema);

export interface ICareCaseNote extends Document {
  careRequestId: string;
  authorOpenId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CareCaseNoteSchema = new Schema<ICareCaseNote>(
  {
    careRequestId: { type: String, required: true, index: true },
    authorOpenId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 12000 },
  },
  { timestamps: true, collection: "careCaseNotes" }
);

CareCaseNoteSchema.index({ careRequestId: 1, createdAt: 1 });
export const CareCaseNote = mongoose.models.CareCaseNote || model<ICareCaseNote>("CareCaseNote", CareCaseNoteSchema);

export interface ICareCaseActivity extends Document {
  careRequestId: string;
  actorOpenId: string;
  action: "created" | "assigned" | "priority_changed" | "status_changed" | "note_added" | "deadline_changed";
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

const CareCaseActivitySchema = new Schema<ICareCaseActivity>(
  {
    careRequestId: { type: String, required: true, index: true },
    actorOpenId: { type: String, required: true, index: true },
    action: { type: String, enum: ["created", "assigned", "priority_changed", "status_changed", "note_added", "deadline_changed"], required: true },
    summary: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true, collection: "careCaseActivities" }
);

CareCaseActivitySchema.index({ careRequestId: 1, createdAt: 1 });
export const CareCaseActivity = mongoose.models.CareCaseActivity || model<ICareCaseActivity>("CareCaseActivity", CareCaseActivitySchema);


// ---- Faith in Action ----
export interface IServiceOpportunity extends Document {
  title: string;
  description: string;
  category: "visitation" | "students" | "food" | "environment" | "skills" | "outreach" | "other";
  location?: string | null;
  startsAt?: Date | null;
  spots: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceOpportunitySchema = new Schema<IServiceOpportunity>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: ["visitation", "students", "food", "environment", "skills", "outreach", "other"], required: true },
    location: { type: String, default: null },
    startsAt: { type: Date, default: null },
    spots: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "serviceOpportunities" }
);

export const ServiceOpportunity = mongoose.models.ServiceOpportunity || model<IServiceOpportunity>("ServiceOpportunity", ServiceOpportunitySchema);

export interface IServiceSignup extends Document {
  opportunityId: string;
  userOpenId: string;
  status: "interested" | "confirmed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSignupSchema = new Schema<IServiceSignup>(
  {
    opportunityId: { type: String, required: true, index: true },
    userOpenId: { type: String, required: true, index: true },
    status: { type: String, enum: ["interested", "confirmed", "cancelled"], default: "interested" },
  },
  { timestamps: true, collection: "serviceSignups" }
);

ServiceSignupSchema.index({ opportunityId: 1, userOpenId: 1 }, { unique: true });
export const ServiceSignup = mongoose.models.ServiceSignup || model<IServiceSignup>("ServiceSignup", ServiceSignupSchema);


// ---- Prayer Room Sessions ----
export interface IPrayerRoomSession extends Document {
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  mode: "voice-video" | "voice";
  capacity: number;
  joinUrl?: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PrayerRoomSessionSchema = new Schema<IPrayerRoomSession>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    startsAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60, min: 15, max: 240 },
    mode: { type: String, enum: ["voice-video", "voice"], default: "voice-video" },
    capacity: { type: Number, default: 30, min: 2, max: 500 },
    joinUrl: { type: String, default: null },
    status: { type: String, enum: ["scheduled", "live", "ended", "cancelled"], default: "scheduled" },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "prayerRoomSessions" }
);

export const PrayerRoomSession = mongoose.models.PrayerRoomSession || model<IPrayerRoomSession>("PrayerRoomSession", PrayerRoomSessionSchema);

export interface IPrayerRoomRegistration extends Document {
  sessionId: string;
  userOpenId: string;
  notificationOptIn: boolean;
  status: "registered" | "attended" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationPreference extends Document {
  userOpenId: string;
  browserNotifications: boolean;
  prayerRoom: boolean;
  sermons: boolean;
  events: boolean;
  email: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userOpenId: { type: String, required: true, unique: true, index: true },
    browserNotifications: { type: Boolean, default: false },
    prayerRoom: { type: Boolean, default: true },
    sermons: { type: Boolean, default: true },
    events: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "notificationPreferences" }
);

export const NotificationPreference = mongoose.models.NotificationPreference || model<INotificationPreference>("NotificationPreference", NotificationPreferenceSchema);

const PrayerRoomRegistrationSchema = new Schema<IPrayerRoomRegistration>(
  {
    sessionId: { type: String, required: true, index: true },
    userOpenId: { type: String, required: true, index: true },
    notificationOptIn: { type: Boolean, default: true },
    status: { type: String, enum: ["registered", "attended", "cancelled"], default: "registered" },
  },
  { timestamps: true, collection: "prayerRoomRegistrations" }
);

PrayerRoomRegistrationSchema.index({ sessionId: 1, userOpenId: 1 }, { unique: true });
export const PrayerRoomRegistration = mongoose.models.PrayerRoomRegistration || model<IPrayerRoomRegistration>("PrayerRoomRegistration", PrayerRoomRegistrationSchema);

export interface INotificationDelivery extends Document {
  dedupeKey: string;
  userOpenId: string;
  kind: "prayer-room" | "sermon" | "event";
  channel: "email" | "webhook";
  status: "processing" | "sent" | "failed";
  attempts: number;
  sentAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationDeliverySchema = new Schema<INotificationDelivery>(
  {
    dedupeKey: { type: String, required: true, unique: true, index: true },
    userOpenId: { type: String, required: true, index: true },
    kind: { type: String, enum: ["prayer-room", "sermon", "event"], required: true },
    channel: { type: String, enum: ["email", "webhook"], required: true },
    status: { type: String, enum: ["processing", "sent", "failed"], default: "processing" },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, collection: "notificationDeliveries" }
);

export const NotificationDelivery = mongoose.models.NotificationDelivery || model<INotificationDelivery>("NotificationDelivery", NotificationDeliverySchema);
