import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, streamingSessions, platformCredentials, sessionPlatformMap
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

export async function createPrayerRequest(data: {
  name: string;
  email: string;
  prayerRequest: string;
  isPublic: boolean;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { prayerRequests } = await import("../drizzle/schema");
  
  return db.insert(prayerRequests).values({
    name: data.name,
    email: data.email,
    prayerRequest: data.prayerRequest,
    isPublic: data.isPublic ? 1 : 0,
    status: 'pending',
  });
}

export async function createDonation(data: {
  donorName: string;
  email: string;
  amount: number;
  method: 'online' | 'bank' | 'mobile' | 'inperson';
  purpose?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { donations } = await import("../drizzle/schema");
  
  return db.insert(donations).values({
    donorName: data.donorName,
    email: data.email,
    amount: data.amount,
    currency: 'KES',
    method: data.method,
    purpose: data.purpose,
    status: 'pending',
  });
}

export async function createContactMessage(data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { contactMessages } = await import("../drizzle/schema");
  
  return db.insert(contactMessages).values({
    name: data.name,
    email: data.email,
    phone: data.phone,
    message: data.message,
    status: 'new',
  });
}


// Events queries
export async function getPublishedEvents() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { events } = await import("../drizzle/schema");
  return db.select().from(events).where(eq(events.isPublished, 1));
}

export async function createEvent(data: {
  title: string;
  description?: string;
  eventType: 'service' | 'event' | 'crusade' | 'meeting' | 'other';
  startDate: Date;
  endDate?: Date;
  location?: string;
  imageUrl?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { events } = await import("../drizzle/schema");
  return db.insert(events).values({
    title: data.title,
    description: data.description,
    eventType: data.eventType,
    startDate: data.startDate,
    endDate: data.endDate,
    location: data.location,
    imageUrl: data.imageUrl,
    isPublished: 0,
  });
}

// Sermons queries
export async function getPublishedSermons() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { sermons } = await import("../drizzle/schema");
  return db.select().from(sermons).where(eq(sermons.isPublished, 1));
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
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { sermons } = await import("../drizzle/schema");
  return db.insert(sermons).values({
    title: data.title,
    speaker: data.speaker,
    description: data.description,
    videoUrl: data.videoUrl,
    audioUrl: data.audioUrl,
    sermonDate: data.sermonDate,
    duration: data.duration,
    isPublished: 0,
  });
}

// Admin settings queries
export async function getAdminSetting(key: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { adminSettings } = await import("../drizzle/schema");
  const result = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function setAdminSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { adminSettings } = await import("../drizzle/schema");
  return db.insert(adminSettings).values({
    key,
    value,
    description,
  }).onDuplicateKeyUpdate({
    set: {
      value,
      description,
    },
  });
}


// Streaming Sessions queries
export async function createStreamingSession(data: {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  status?: 'scheduled' | 'live' | 'ended' | 'archived';
}): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { streamingSessions } = await import("../drizzle/schema");
  const [inserted] = await db.insert(streamingSessions).values({
    title: data.title,
    description: data.description,
    startTime: data.startTime,
    endTime: data.endTime,
    status: data.status || 'scheduled',
  }).$returningId();

  return inserted.id;
}

export async function getStreamingSessions() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { streamingSessions } = await import("../drizzle/schema");
  return db.select().from(streamingSessions);
}

// Platform Connections queries
export async function createPlatformConnection(data: {
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'twitch';
  accountName: string;
  accessToken: string;
  refreshToken?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { platformConnections } = await import("../drizzle/schema");
  return db.insert(platformConnections).values({
    platform: data.platform,
    accountName: data.accountName,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
}

export async function getActivePlatformConnections() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { platformConnections } = await import("../drizzle/schema");
  return db.select().from(platformConnections).where(eq(platformConnections.isActive, 1));
}

export async function deactivatePlatformConnection(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { platformConnections } = await import("../drizzle/schema");
  return db.update(platformConnections).set({ isActive: 0 }).where(eq(platformConnections.id, id));
}

// Camera Devices queries
export async function registerCameraDevice(data: {
  name: string;
  deviceId: string;
  type: 'webcam' | 'external' | 'phone' | 'other';
  resolution?: string;
  frameRate?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { cameraDevices } = await import("../drizzle/schema");
  return db.insert(cameraDevices).values({
    name: data.name,
    deviceId: data.deviceId,
    type: data.type,
    resolution: data.resolution,
    frameRate: data.frameRate,
    status: 'available',
  });
}

export async function getAvailableCameras() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { cameraDevices } = await import("../drizzle/schema");
  return db.select().from(cameraDevices).where(eq(cameraDevices.isActive, 1));
}

// Stream Broadcasts queries
export async function createStreamBroadcast(data: {
  sessionId: number;
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'twitch';
  broadcastUrl?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { streamBroadcasts } = await import("../drizzle/schema");
  return db.insert(streamBroadcasts).values({
    sessionId: data.sessionId,
    platform: data.platform,
    broadcastUrl: data.broadcastUrl,
    status: 'pending',
  });
}



// Additional streaming helpers
export async function getActiveStream() {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(streamingSessions)
    .where(eq(streamingSessions.status, 'live'))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateStreamStatus(sessionId: number, status: 'scheduled' | 'live' | 'ended' | 'archived') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(streamingSessions)
    .set({ status, updatedAt: new Date() })
    .where(eq(streamingSessions.id, sessionId));
}

export async function getPlatformCredentials(platform: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(platformCredentials)
    .where(eq(platformCredentials.platform, platform as any))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .insert(platformCredentials)
    .values({
      platform: data.platform as any,
      streamKey: data.streamKey,
      streamUrl: data.streamUrl,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accountId: data.accountId,
      accountName: data.accountName,
      isActive: 1,
    });
}

export async function getSessionPlatforms(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(sessionPlatformMap)
    .where(eq(sessionPlatformMap.sessionId, sessionId));
  
  return result;
}

export async function addSessionPlatform(data: {
  sessionId: number;
  platform: string;
  broadcastUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(sessionPlatformMap).values({
    sessionId: data.sessionId,
    platform: data.platform as any,
    broadcastUrl: data.broadcastUrl,
    status: 'pending',
  });
}
