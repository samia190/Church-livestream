import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { 
  createPrayerRequest, 
  createDonation,
  updateDonationProvider,
  findDonationByProviderReference,
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
  addSessionPlatform,
  getPrayerRequests,
  updatePrayerRequestStatus,
  getDonations,
  updateDonationStatus,
  getContactMessages,
  updateContactMessageStatus,
  updateEvent,
  deleteEvent,
  updateSermon,
  deleteSermon,
  getDashboardStats,
  getAllEvents,
  getAllSermons
} from "./db";
import { TRPCError } from "@trpc/server";
import { createRestreamService } from "./_core/restream";
import { capturePaypalOrder, createPaypalOrder, initiateMpesa, verifyPaypalWebhook, newIdempotencyKey } from "./_core/payments";

// Initialize Restream service (requires API key from environment)
const restreamApiKey = process.env.RESTREAM_API_KEY || '';
const restreamService = restreamApiKey ? createRestreamService(restreamApiKey) : null;

// All procedures below this boundary require a server-verified administrator session.
const adminOnly = adminProcedure;

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
        donorName: z.string().min(1).max(120),
        email: z.string().email(),
        phone: z.string().optional(),
        amount: z.number().positive().max(10_000_000),
        currency: z.enum(['KES', 'USD']).default('KES'),
        method: z.enum(['mpesa', 'paypal', 'bank', 'inperson']),
        purpose: z.string().max(200).optional(),
        idempotencyKey: z.string().uuid().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const idempotencyKey = input.idempotencyKey ?? newIdempotencyKey();
        const provider = input.method === 'mpesa' ? 'mpesa' : input.method === 'paypal' ? 'paypal' : undefined;
        const methodForRecord: 'online' | 'bank' | 'mobile' | 'inperson' = input.method === 'mpesa' ? 'mobile' : input.method === 'paypal' ? 'online' : input.method;
        const donation = await createDonation({
          donorName: input.donorName,
          email: input.email,
          phone: input.phone,
          amount: input.amount,
          currency: input.currency,
          method: methodForRecord,
          provider,
          purpose: input.purpose,
          idempotencyKey,
        });
        if (donation.status === 'completed') return { success: true, donationId: donation._id.toString(), status: donation.status, message: 'Donation already completed' };
        if (!provider) return { success: true, donationId: donation._id.toString(), status: donation.status, message: 'Donation recorded for manual confirmation' };
        if (provider === 'paypal' && input.currency !== 'USD') throw new TRPCError({ code: 'BAD_REQUEST', message: 'PayPal donations must use USD' });
        const callbackBaseUrl = process.env.PUBLIC_BASE_URL || `${ctx.req.protocol}://${ctx.req.get('host')}`;
        try {
          const payment = provider === 'mpesa'
            ? await initiateMpesa({ amount: input.amount, currency: input.currency, donorName: input.donorName, email: input.email, phone: input.phone, purpose: input.purpose, callbackBaseUrl, reference: idempotencyKey, donationId: donation._id.toString() })
            : await createPaypalOrder({ amount: input.amount, currency: input.currency, donorName: input.donorName, email: input.email, purpose: input.purpose, callbackBaseUrl, reference: idempotencyKey, donationId: donation._id.toString() });
          await updateDonationProvider(donation._id.toString(), payment.providerReference);
          return { success: true, donationId: donation._id.toString(), status: 'pending' as const, provider: payment.provider, providerReference: payment.providerReference, approvalUrl: payment.approvalUrl, message: payment.customerMessage };
        } catch (error) {
          await updateDonationStatus(donation._id.toString(), 'failed');
          console.error('Donation provider error:', error);
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: error instanceof Error ? error.message : 'Payment provider is not configured' });
        }
      }),
    capturePaypal: publicProcedure
      .input(z.object({ donationId: z.string().min(1), orderId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await capturePaypalOrder(input.orderId);
        if (result.completed) await updateDonationStatus(input.donationId, 'completed', result.transactionId);
        return { success: result.completed, status: result.completed ? 'completed' as const : 'pending' as const, transactionId: result.transactionId };
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
        return await getAllEvents();
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

    update: adminOnly
      .input(z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        eventType: z.enum(['service', 'event', 'crusade', 'meeting', 'other']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        location: z.string().optional(),
        imageUrl: z.string().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateEvent(id, data);
      }),

    delete: adminOnly
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteEvent(input.id)),
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
        return await getAllSermons();
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

    update: adminOnly
      .input(z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        speaker: z.string().optional(),
        description: z.string().optional(),
        videoUrl: z.string().url().optional(),
        audioUrl: z.string().url().optional(),
        sermonDate: z.date().optional(),
        duration: z.number().nonnegative().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateSermon(id, data);
      }),

    delete: adminOnly
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteSermon(input.id)),
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
      .input(z.object({ sessionId: z.string() }))
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
      .input(z.object({ id: z.string() }))
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

  adminContent: router({
    getPrayerRequests: adminOnly.query(() => getPrayerRequests()),
    updatePrayerRequestStatus: adminOnly
      .input(z.object({ id: z.string(), status: z.enum(["pending", "approved", "archived"]) }))
      .mutation(({ input }) => updatePrayerRequestStatus(input.id, input.status)),
    getDonations: adminOnly.query(() => getDonations()),
    updateDonationStatus: adminOnly
      .input(z.object({
        id: z.string(),
        status: z.enum(["pending", "completed", "failed"]),
        transactionId: z.string().optional(),
      }))
      .mutation(({ input }) => updateDonationStatus(input.id, input.status, input.transactionId)),
    getContactMessages: adminOnly.query(() => getContactMessages()),
    updateContactMessageStatus: adminOnly
      .input(z.object({ id: z.string(), status: z.enum(["new", "read", "responded"]) }))
      .mutation(({ input }) => updateContactMessageStatus(input.id, input.status)),
  }),

  // Dashboard Stats Router
  dashboard: router({
    getStats: adminOnly.query(() => getDashboardStats()),
  }),
});

export type AppRouter = typeof appRouter;
