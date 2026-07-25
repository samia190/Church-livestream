import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { 
  createPrayerRequest, 
  createDonation, 
  createContactMessage, 
  getPublishedEvents, 
  getPublishedSermons, 
  createEvent, 
  createSermon,
  getStreamingSessions,
  createStreamingSession,
  getActivePlatformConnections,
  createPlatformConnection,
  deactivatePlatformConnection,
  getAvailableCameras,
  registerCameraDevice,
  getActiveStream,
  updateStreamStatus,
  getPlatformCredentials,
  savePlatformCredential,
  getSessionPlatforms,
  addSessionPlatform
} from "./db";
import { TRPCError } from "@trpc/server";
import { createRestreamService } from "./_core/restream";

// Initialize Restream service (requires API key from environment)
const restreamApiKey = process.env.RESTREAM_API_KEY || '';
const restreamService = restreamApiKey ? createRestreamService(restreamApiKey) : null;

// Helper to check admin role
const adminOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  prayer: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        prayerRequest: z.string().min(1),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await createPrayerRequest({
            name: input.name,
            email: input.email,
            prayerRequest: input.prayerRequest,
            isPublic: input.isPublic ?? false,
          });
          return { success: true, message: 'Prayer request submitted successfully' };
        } catch (error) {
          console.error('Prayer request error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit prayer request' });
        }
      }),
  }),

  donation: router({
    submit: publicProcedure
      .input(z.object({
        donorName: z.string().min(1),
        email: z.string().email(),
        amount: z.number().positive(),
        method: z.enum(['online', 'bank', 'mobile', 'inperson']),
        purpose: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await createDonation({
            donorName: input.donorName,
            email: input.email,
            amount: input.amount,
            method: input.method,
            purpose: input.purpose,
          });
          return { success: true, message: 'Donation recorded successfully' };
        } catch (error) {
          console.error('Donation error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process donation' });
        }
      }),
  }),

  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        message: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          await createContactMessage({
            name: input.name,
            email: input.email,
            phone: input.phone,
            message: input.message,
          });
          return { success: true, message: 'Message sent successfully' };
        } catch (error) {
          console.error('Contact message error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send message' });
        }
      }),
  }),

  // Events Admin Router
  events: router({
    getPublished: publicProcedure.query(async () => {
      try {
        return await getPublishedEvents();
      } catch (error) {
        console.error('Events fetch error:', error);
        return [];
      }
    }),
    
    getAll: adminOnly.query(async () => {
      try {
        return await getPublishedEvents();
      } catch (error) {
        console.error('Events fetch error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
    }),

    create: adminOnly
      .input(z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        eventType: z.enum(['service', 'event', 'crusade', 'meeting', 'other']),
        startDate: z.date(),
        endDate: z.date().optional(),
        location: z.string().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await createEvent(input);
          return { success: true, message: 'Event created successfully' };
        } catch (error) {
          console.error('Event creation error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create event' });
        }
      }),
  }),

  // Sermons Admin Router
  sermons: router({
    getPublished: publicProcedure.query(async () => {
      try {
        return await getPublishedSermons();
      } catch (error) {
        console.error('Sermons fetch error:', error);
        return [];
      }
    }),

    getAll: adminOnly.query(async () => {
      try {
        return await getPublishedSermons();
      } catch (error) {
        console.error('Sermons fetch error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
    }),

    create: adminOnly
      .input(z.object({
        title: z.string().min(1, 'Title is required'),
        speaker: z.string().optional(),
        description: z.string().optional(),
        videoUrl: z.string().optional(),
        audioUrl: z.string().optional(),
        sermonDate: z.date(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await createSermon(input);
          return { success: true, message: 'Sermon created successfully' };
        } catch (error) {
          console.error('Sermon creation error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create sermon' });
        }
      }),
  }),

  // Streaming Admin Router
  streaming: router({
    // Public procedure to get active stream for viewers
    getActiveStream: publicProcedure.query(async () => {
      try {
        return await getActiveStream();
      } catch (error) {
        console.error('Active stream fetch error:', error);
        return null;
      }
    }),

    getSessions: adminOnly.query(async () => {
      try {
        return await getStreamingSessions();
      } catch (error) {
        console.error('Streaming sessions fetch error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
    }),

    createSession: adminOnly
      .input(z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        startTime: z.date(),
        endTime: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const sessionId = await createStreamingSession(input);
          return { success: true, message: 'Streaming session created successfully', sessionId };
        } catch (error) {
          console.error('Streaming session creation error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create streaming session' });
        }
      }),

    // Creates a session and marks it live in one step — this is what the
    // admin's "Go Live" button calls.
    goLive: adminOnly
      .input(z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const sessionId = await createStreamingSession({
            title: input.title,
            description: input.description,
            startTime: new Date(),
            status: 'live',
          });
          return { success: true, sessionId };
        } catch (error) {
          console.error('Go live error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to start live session' });
        }
      }),

    // Marks a session as ended — called when the admin clicks "Stop Live"
    // and also by the signaling server if the admin disconnects unexpectedly.
    endLive: adminOnly
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await updateStreamStatus(input.sessionId, 'ended');
          return { success: true };
        } catch (error) {
          console.error('End live error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to end live session' });
        }
      }),

    getPlatforms: adminOnly.query(async () => {
      try {
        return await getActivePlatformConnections();
      } catch (error) {
        console.error('Platforms fetch error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
    }),

    addPlatform: adminOnly
      .input(z.object({
        platform: z.enum(['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch']),
        accountName: z.string().min(1),
        accessToken: z.string().min(1),
        refreshToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await createPlatformConnection(input);
          return { success: true, message: 'Platform connected successfully' };
        } catch (error) {
          console.error('Platform connection error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to connect platform' });
        }
      }),

    removePlatform: adminOnly
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await deactivatePlatformConnection(input.id);
          return { success: true, message: 'Platform disconnected' };
        } catch (error) {
          console.error('Platform disconnect error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to disconnect platform' });
        }
      }),

    getCameras: adminOnly.query(async () => {
      try {
        return await getAvailableCameras();
      } catch (error) {
        console.error('Cameras fetch error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
    }),

    registerCamera: adminOnly
      .input(z.object({
        name: z.string().min(1),
        deviceId: z.string().min(1),
        type: z.enum(['webcam', 'external', 'phone', 'other']),
        resolution: z.string().optional(),
        frameRate: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await registerCameraDevice(input);
          return { success: true, message: 'Camera registered successfully' };
        } catch (error) {
          console.error('Camera registration error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to register camera' });
        }
      }),

    // Restream multi-platform broadcasting
    startMultiPlatformBroadcast: adminOnly
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch'])),
      }))
      .mutation(async ({ input }) => {
        try {
          if (!restreamService) {
            return {
              success: true,
              message: "Multi-platform broadcast started (demo mode)",
              broadcastId: `broadcast_${Date.now()}`,
              ingestUrl: "rtmp://live.restream.io/live",
              streamKey: "demo-stream-key",
              channels: input.platforms.length,
            };
          }

          const broadcast = await restreamService!.createBroadcast(
            input.title,
            input.description || "",
            input.platforms
          );

          const ingestUrl = await restreamService!.getIngestUrl(broadcast.id);

          return {
            success: true,
            message: "Multi-platform broadcast started",
            broadcastId: broadcast.id,
            ingestUrl: ingestUrl.rtmpUrl,
            streamKey: ingestUrl.streamKey,
            channels: broadcast.channels.length,
          };
        } catch (error) {
          console.error("Multi-platform broadcast error:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to start broadcast" });
        }
      }),

    stopMultiPlatformBroadcast: adminOnly
      .input(z.object({ broadcastId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          if (!restreamService) {
            return { success: true, message: 'Multi-platform broadcast stopped (demo mode)' };
          }
          await restreamService!.stopBroadcast(input.broadcastId);
          return { success: true, message: 'Multi-platform broadcast stopped' };
        } catch (error) {
          console.error('Stop broadcast error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      }),
  }),

  // Dashboard Stats Router
  dashboard: router({
    getStats: adminOnly.query(async () => {
      return {
        members: 2700,
        events: 12,
        sermons: 48,
        prayerRequests: 156,
        donations: 42500,
        liveViewers: 0,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
