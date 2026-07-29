import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

/**
 * Prayer requests table for storing visitor prayer submissions
 */
export const prayerRequests = mysqlTable('prayerRequests', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  prayerRequest: text('prayerRequest').notNull(),
  isPublic: int('isPublic').default(0).notNull(),
  status: mysqlEnum('status', ['pending', 'approved', 'archived']).default('pending').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type PrayerRequest = typeof prayerRequests.$inferSelect;
export type InsertPrayerRequest = typeof prayerRequests.$inferInsert;

/**
 * Donations/Contributions table for tracking giving
 */
export const donations = mysqlTable('donations', {
  id: int('id').autoincrement().primaryKey(),
  donorName: varchar('donorName', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  amount: int('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('KES').notNull(),
  method: mysqlEnum('method', ['online', 'bank', 'mobile', 'inperson']).notNull(),
  purpose: varchar('purpose', { length: 255 }),
  status: mysqlEnum('status', ['pending', 'completed', 'failed']).default('pending').notNull(),
  transactionId: varchar('transactionId', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Donation = typeof donations.$inferSelect;
export type InsertDonation = typeof donations.$inferInsert;

/**
 * Contact messages table for storing visitor inquiries
 */
export const contactMessages = mysqlTable('contactMessages', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  message: text('message').notNull(),
  status: mysqlEnum('status', ['new', 'read', 'responded']).default('new').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;

/**
 * Events table for managing church services and events
 */
export const events = mysqlTable('events', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  eventType: mysqlEnum('eventType', ['service', 'event', 'crusade', 'meeting', 'other']).notNull(),
  startDate: timestamp('startDate').notNull(),
  endDate: timestamp('endDate'),
  location: varchar('location', { length: 255 }),
  imageUrl: text('imageUrl'),
  isPublished: int('isPublished').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Sermons table for managing sermon content
 */
export const sermons = mysqlTable('sermons', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  speaker: varchar('speaker', { length: 255 }),
  description: text('description'),
  videoUrl: text('videoUrl'),
  audioUrl: text('audioUrl'),
  sermonDate: timestamp('sermonDate').notNull(),
  duration: int('duration'),
  isPublished: int('isPublished').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Sermon = typeof sermons.$inferSelect;
export type InsertSermon = typeof sermons.$inferInsert;

/**
 * Admin settings table for storing church information
 */
export const adminSettings = mysqlTable('adminSettings', {
  id: int('id').autoincrement().primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
  description: varchar('description', { length: 500 }),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;


/**
 * Streaming sessions table for managing live streams
 */
export const streamingSessions = mysqlTable('streamingSessions', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: mysqlEnum('status', ['scheduled', 'live', 'ended', 'archived']).default('scheduled').notNull(),
  startTime: timestamp('startTime').notNull(),
  endTime: timestamp('endTime'),
  streamKey: varchar('streamKey', { length: 255 }), // Removed unique constraint — multiple sessions can have null streamKey
  rtmpUrl: text('rtmpUrl'),
  isPublished: int('isPublished').default(0).notNull(),
  recordingUrl: text('recordingUrl'),
  viewerCount: int('viewerCount').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type StreamingSession = typeof streamingSessions.$inferSelect;
export type InsertStreamingSession = typeof streamingSessions.$inferInsert;

/**
 * Platform connections table for storing social media credentials
 */
export const platformConnections = mysqlTable('platformConnections', {
  id: int('id').autoincrement().primaryKey(),
  platform: mysqlEnum('platform', ['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch']).notNull(),
  accountName: varchar('accountName', { length: 255 }).notNull(),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  isActive: int('isActive').default(1).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type PlatformConnection = typeof platformConnections.$inferSelect;
export type InsertPlatformConnection = typeof platformConnections.$inferInsert;

/**
 * Camera devices table for managing connected cameras
 */
export const cameraDevices = mysqlTable('cameraDevices', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  deviceId: varchar('deviceId', { length: 255 }).notNull().unique(),
  type: mysqlEnum('type', ['webcam', 'external', 'phone', 'other']).notNull(),
  status: mysqlEnum('status', ['available', 'in_use', 'offline']).default('available').notNull(),
  resolution: varchar('resolution', { length: 50 }),
  frameRate: int('frameRate'),
  isActive: int('isActive').default(1).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type CameraDevice = typeof cameraDevices.$inferSelect;
export type InsertCameraDevice = typeof cameraDevices.$inferInsert;

/**
 * Stream broadcasts table for tracking multi-platform broadcasts
 */
export const streamBroadcasts = mysqlTable('streamBroadcasts', {
  id: int('id').autoincrement().primaryKey(),
  sessionId: int('sessionId').notNull(),
  platform: mysqlEnum('platform', ['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch']).notNull(),
  broadcastUrl: text('broadcastUrl'),
  status: mysqlEnum('status', ['pending', 'live', 'ended']).default('pending').notNull(),
  viewerCount: int('viewerCount').default(0),
  startTime: timestamp('startTime'),
  endTime: timestamp('endTime'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type StreamBroadcast = typeof streamBroadcasts.$inferSelect;
export type InsertStreamBroadcast = typeof streamBroadcasts.$inferInsert;


/**
 * Platform stream credentials table for storing API keys and stream keys
 */
export const platformCredentials = mysqlTable('platformCredentials', {
  id: int('id').autoincrement().primaryKey(),
  platform: mysqlEnum('platform', ['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch', 'restream']).notNull(),
  streamKey: varchar('streamKey', { length: 500 }),
  streamUrl: text('streamUrl'),
  apiKey: text('apiKey'),
  apiSecret: text('apiSecret'),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accountId: varchar('accountId', { length: 255 }),
  accountName: varchar('accountName', { length: 255 }),
  isActive: int('isActive').default(1).notNull(),
  expiresAt: timestamp('expiresAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type PlatformCredential = typeof platformCredentials.$inferSelect;
export type InsertPlatformCredential = typeof platformCredentials.$inferInsert;

/**
 * Stream session platform mapping for tracking which platforms are broadcasting
 */
export const sessionPlatformMap = mysqlTable('sessionPlatformMap', {
  id: int('id').autoincrement().primaryKey(),
  sessionId: int('sessionId').notNull(),
  platform: mysqlEnum('platform', ['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch']).notNull(),
  broadcastId: varchar('broadcastId', { length: 255 }),
  broadcastUrl: text('broadcastUrl'),
  status: mysqlEnum('status', ['pending', 'live', 'ended', 'failed']).default('pending').notNull(),
  viewerCount: int('viewerCount').default(0),
  startTime: timestamp('startTime'),
  endTime: timestamp('endTime'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type SessionPlatformMap = typeof sessionPlatformMap.$inferSelect;
export type InsertSessionPlatformMap = typeof sessionPlatformMap.$inferInsert;
