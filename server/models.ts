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
  amount: number;
  currency: string;
  method: "online" | "bank" | "mobile" | "inperson";
  purpose?: string | null;
  status: "pending" | "completed" | "failed";
  transactionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    donorName: { type: String, required: true },
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "KES" },
    method: {
      type: String,
      enum: ["online", "bank", "mobile", "inperson"],
      required: true,
    },
    purpose: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    transactionId: { type: String, default: null },
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
  sessionId: string; // ObjectId of StreamingSession
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
  sessionId: string; // ObjectId of StreamingSession
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
