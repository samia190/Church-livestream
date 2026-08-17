import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  router,
  adminProcedure,
} from "./_core/trpc";
import { z } from "zod";
import {
  createLiveKitParticipantToken,
  isLiveKitConfigured,
} from "./_core/livekit";
import {
  createPrayerRequest,
  createDonation,
  getDonationById,
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
  createProductionCameraInvitation,
  listProductionCameraInvitations,
  revokeProductionCameraInvitation,
  acceptProductionCameraInvitation,
  touchProductionCameraInvitation,
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
  getUserByEmail,
  createLocalUser,
  updateUserLastSignedIn,
  getAllEvents,
  getAllSermons,
  getSpiritualJourneys,
  upsertSpiritualJourney,
  getFaithJournalEntries,
  createFaithJournalEntry,
  deleteFaithJournalEntry,
  getUserPrayerRequests,
  getActiveCircles,
  getUserCircleMemberships,
  requestCircleMembership,
  createCareRequest,
  getUserCareRequests,
  getCareRequests,
  updateCareRequestStatus,
  getCareCaseNotes,
  getCareCaseActivity,
  addCareCaseNote,
  assignCareRequest,
  updateCareRequestCase,
  getActiveServiceOpportunities,
  getAllServiceOpportunities,
  createServiceOpportunity,
  updateServiceOpportunity,
  getServiceSignups,
  updateServiceSignupStatus,
  getUserServiceSignups,
  signupForService,
  getAllPrayerRoomSessions,
  createPrayerRoomSession,
  updatePrayerRoomSession,
  getUpcomingPrayerRoomSessions,
  getPrayerRoomSessionStatus,
  getRegisteredPrayerRoomJoin,
  getUserPrayerRoomRegistrations,
  registerForPrayerRoom,
  getNotificationPreferences,
  updateNotificationPreferences,
  getCircleById,
  getManagedCircles,
  getCircleMembershipRequests,
  updateCircleMembershipStatus,
  createCircle,
  updateCircle,
} from "./db";
import { TRPCError } from "@trpc/server";
import { createRestreamService } from "./_core/restream";
import {
  capturePaypalOrder,
  createPaypalOrder,
  createStripeCheckoutSession,
  initiateMpesa,
  verifyPaypalWebhook,
  newIdempotencyKey,
} from "./_core/payments";
import {
  hashPassword,
  normalizeEmail,
  sdk,
  toPublicUser,
  verifyPassword,
} from "./_core/sdk";
import {
  buildGivingDescription,
  buildMpesaAccountReference,
  GIVING_PROJECT_VALUES,
  GIVING_PURPOSE_VALUES,
} from "../shared/giving";

// Initialize Restream service (requires API key from environment)
const restreamApiKey = process.env.RESTREAM_API_KEY || "";
const restreamService = restreamApiKey
  ? createRestreamService(restreamApiKey)
  : null;

// All procedures below this boundary require a server-verified administrator session.
const adminOnly = adminProcedure;

async function requireCircleManager(
  circleId: string,
  user: { openId: string; role?: string }
) {
  const circle = (await getCircleById(circleId)) as any;
  if (!circle)
    throw new TRPCError({ code: "NOT_FOUND", message: "Circle not found" });
  if (user.role !== "admin" && circle.leaderOpenId !== user.openId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only the circle leader or an administrator can manage this circle",
    });
  }
  return circle;
}

const discipleshipPaths = [
  {
    id: "foundations",
    title: "Foundations of Faith",
    description: "A gentle beginning for seeking hearts and new believers.",
  },
  {
    id: "prayer",
    title: "A Life of Prayer",
    description: "Build a truthful, steady rhythm of meeting God in prayer.",
  },
  {
    id: "hope",
    title: "Hope in Difficult Seasons",
    description:
      "Walk with Scripture and community through grief, stress, and uncertainty.",
  },
  {
    id: "service",
    title: "Faith in Action",
    description:
      "Discover how love becomes visible through service and generosity.",
  },
] as const;

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signUp: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
          email: z.string().trim().email().max(320),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email);
        const existing = await getUserByEmail(email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists",
          });
        }
        const credentials = await hashPassword(input.password);
        const user = await createLocalUser({
          name: input.name,
          email,
          ...credentials,
          role: "user",
        });
        const sessionToken = await sdk.createSessionToken(user);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true, user: toPublicUser(user) } as const;
      }),
    signIn: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email);
        const user = await getUserByEmail(email, true);
        let authenticatedUser = user;
        if (
          !authenticatedUser &&
          process.env.LOCAL_ADMIN_EMAIL &&
          process.env.LOCAL_ADMIN_PASSWORD &&
          normalizeEmail(process.env.LOCAL_ADMIN_EMAIL) === email &&
          input.password === process.env.LOCAL_ADMIN_PASSWORD
        ) {
          const credentials = await hashPassword(input.password);
          authenticatedUser = await createLocalUser({
            name: "NICA Administrator",
            email,
            ...credentials,
            role: "admin",
          });
        }
        if (
          !authenticatedUser ||
          !authenticatedUser.passwordHash ||
          !authenticatedUser.passwordSalt ||
          !(await verifyPassword(
            input.password,
            authenticatedUser.passwordHash,
            authenticatedUser.passwordSalt
          ))
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Incorrect email or password",
          });
        }
        await updateUserLastSignedIn(authenticatedUser.openId);
        const sessionToken = await sdk.createSessionToken(authenticatedUser);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true, user: authenticatedUser } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  welcome: router({
    paths: publicProcedure.query(() => discipleshipPaths),
    save: protectedProcedure
      .input(
        z.object({
          pathId: z.string(),
          pathTitle: z.string(),
          currentStep: z.number().int().min(0),
          completedSteps: z.array(z.number().int().min(0)).default([]),
          welcomeAnswers: z.record(z.string(), z.string()).default({}),
        })
      )
      .mutation(({ input, ctx }) =>
        upsertSpiritualJourney({ ...input, userOpenId: ctx.user.openId })
      ),
    progress: protectedProcedure.query(({ ctx }) =>
      getSpiritualJourneys(ctx.user.openId)
    ),
  }),

  journal: router({
    list: protectedProcedure.query(({ ctx }) =>
      getFaithJournalEntries(ctx.user.openId)
    ),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().max(160).optional(),
          content: z.string().min(1).max(12000),
          mood: z
            .enum(["grateful", "hopeful", "burdened", "peaceful", "seeking"])
            .optional(),
          scriptureReference: z.string().max(160).optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        createFaithJournalEntry({ ...input, userOpenId: ctx.user.openId })
      ),
    remove: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(({ input, ctx }) =>
        deleteFaithJournalEntry(ctx.user.openId, input.id)
      ),
  }),

  notifications: router({
    mine: protectedProcedure.query(({ ctx }) =>
      getNotificationPreferences(ctx.user.openId)
    ),
    update: protectedProcedure
      .input(
        z.object({
          browserNotifications: z.boolean().optional(),
          prayerRoom: z.boolean().optional(),
          sermons: z.boolean().optional(),
          events: z.boolean().optional(),
          email: z.boolean().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateNotificationPreferences({ ...input, userOpenId: ctx.user.openId })
      ),
  }),

  prayerRoom: router({
    upcoming: publicProcedure.query(() => getUpcomingPrayerRoomSessions()),
    mine: protectedProcedure.query(({ ctx }) =>
      getUserPrayerRoomRegistrations(ctx.user.openId)
    ),
    status: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        try {
          return await getPrayerRoomSessionStatus(
            input.sessionId,
            ctx.user.openId
          );
        } catch (error) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Unable to read Prayer Room status",
          });
        }
      }),
    join: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await getRegisteredPrayerRoomJoin(
            input.sessionId,
            ctx.user.openId
          );
        } catch (error) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Unable to join this Prayer Room",
          });
        }
      }),
    register: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          notificationOptIn: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await registerForPrayerRoom({
            ...input,
            userOpenId: ctx.user.openId,
          });
        } catch (error) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Unable to register for this Prayer Room",
          });
        }
      }),
  }),

  scripture: router({
    reflect: protectedProcedure
      .input(
        z.object({
          question: z.string().min(1).max(4000),
          scriptureReference: z.string().max(200).optional(),
        })
      )
      .mutation(({ input }) => {
        const referenceLine = input.scriptureReference
          ? `Read ${input.scriptureReference} slowly in your preferred Bible translation and notice one phrase that meets your question.`
          : "Choose a short passage that speaks to your question and read it slowly before responding to it.";
        return {
          content: `A guided reflection for: “${input.question.trim()}”\n\n${referenceLine}\n\nWhat might this invite you to name honestly before God? Write one sentence, then choose one small faithful step for today. If this question involves danger, abuse, self-harm, addiction, grief, or a serious family crisis, please reach out to a trusted pastor and a qualified local professional or emergency service.`,
        };
      }),
  }),

  service: router({
    list: publicProcedure.query(() => getActiveServiceOpportunities()),
    mine: protectedProcedure.query(({ ctx }) =>
      getUserServiceSignups(ctx.user.openId)
    ),
    signup: protectedProcedure
      .input(z.object({ opportunityId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await signupForService(input.opportunityId, ctx.user.openId);
        } catch (error) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Unable to join this service opportunity",
          });
        }
      }),
  }),

  circles: router({
    list: publicProcedure.query(() => getActiveCircles()),
    memberships: protectedProcedure.query(({ ctx }) =>
      getUserCircleMemberships(ctx.user.openId)
    ),
    mine: protectedProcedure.query(({ ctx }) =>
      getManagedCircles(ctx.user.openId)
    ),
    requests: protectedProcedure
      .input(z.object({ circleId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        await requireCircleManager(input.circleId, ctx.user);
        return getCircleMembershipRequests(input.circleId);
      }),
    requestMembership: protectedProcedure
      .input(z.object({ circleId: z.string().min(1) }))
      .mutation(({ input, ctx }) =>
        requestCircleMembership(input.circleId, ctx.user.openId)
      ),
    moderateMembership: protectedProcedure
      .input(
        z.object({
          membershipId: z.string().min(1),
          circleId: z.string().min(1),
          status: z.enum(["active", "left"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireCircleManager(input.circleId, ctx.user);
        return updateCircleMembershipStatus(input.membershipId, input.status);
      }),
  }),

  adminService: router({
    list: adminOnly.query(() => getAllServiceOpportunities()),
    signups: adminOnly.query(() => getServiceSignups()),
    create: adminOnly
      .input(
        z.object({
          title: z.string().min(2).max(160),
          description: z.string().min(10).max(4000),
          category: z.enum([
            "visitation",
            "students",
            "food",
            "environment",
            "skills",
            "outreach",
            "other",
          ]),
          location: z.string().max(300).optional(),
          startsAt: z.date().nullable().optional(),
          spots: z.number().int().min(0).max(10000),
        })
      )
      .mutation(({ input }) =>
        createServiceOpportunity({
          ...input,
          startsAt: input.startsAt ?? undefined,
        })
      ),
    update: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          title: z.string().min(2).max(160).optional(),
          description: z.string().min(10).max(4000).optional(),
          category: z
            .enum([
              "visitation",
              "students",
              "food",
              "environment",
              "skills",
              "outreach",
              "other",
            ])
            .optional(),
          location: z.string().max(300).nullable().optional(),
          startsAt: z.date().nullable().optional(),
          spots: z.number().int().min(0).max(10000).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateServiceOpportunity(id, data);
      }),
    updateSignup: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          status: z.enum(["interested", "confirmed", "cancelled"]),
        })
      )
      .mutation(({ input }) =>
        updateServiceSignupStatus(input.id, input.status)
      ),
  }),

  adminPrayerRoom: router({
    list: adminOnly.query(() => getAllPrayerRoomSessions()),
    create: adminOnly
      .input(
        z.object({
          title: z.string().min(2).max(160),
          description: z.string().min(10).max(4000),
          startsAt: z.date(),
          durationMinutes: z.number().int().min(15).max(240),
          mode: z.enum(["voice-video", "voice"]),
          capacity: z.number().int().min(2).max(500),
          joinUrl: z
            .string()
            .url()
            .refine(
              value => value.startsWith("https://"),
              "Prayer Room links must use HTTPS"
            )
            .optional(),
          isPublished: z.boolean().default(false),
        })
      )
      .mutation(({ input }) => createPrayerRoomSession(input)),
    update: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          title: z.string().min(2).max(160).optional(),
          description: z.string().min(10).max(4000).optional(),
          startsAt: z.date().optional(),
          durationMinutes: z.number().int().min(15).max(240).optional(),
          mode: z.enum(["voice-video", "voice"]).optional(),
          capacity: z.number().int().min(2).max(500).optional(),
          joinUrl: z
            .string()
            .url()
            .refine(
              value => value.startsWith("https://"),
              "Prayer Room links must use HTTPS"
            )
            .nullable()
            .optional(),
          status: z
            .enum(["scheduled", "live", "ended", "cancelled"])
            .optional(),
          isPublished: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updatePrayerRoomSession(id, data);
      }),
  }),

  adminCircles: router({
    list: adminOnly.query(() => getActiveCircles()),
    requests: adminOnly.query(() => getCircleMembershipRequests()),
    create: adminOnly
      .input(
        z.object({
          name: z.string().min(2).max(120),
          description: z.string().min(10).max(2000),
          category: z.enum([
            "small-group",
            "prayer",
            "youth",
            "service",
            "family",
          ]),
          meetingDetails: z.string().max(500).optional(),
          leaderOpenId: z.string().max(200).optional(),
        })
      )
      .mutation(({ input }) => createCircle(input)),
    update: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          name: z.string().min(2).max(120).optional(),
          description: z.string().min(10).max(2000).optional(),
          category: z
            .enum(["small-group", "prayer", "youth", "service", "family"])
            .optional(),
          meetingDetails: z.string().max(500).optional(),
          leaderOpenId: z.string().max(200).nullable().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCircle(id, data);
      }),
    moderateMembership: adminOnly
      .input(
        z.object({
          membershipId: z.string().min(1),
          status: z.enum(["active", "left"]),
        })
      )
      .mutation(({ input }) =>
        updateCircleMembershipStatus(input.membershipId, input.status)
      ),
  }),

  care: router({
    mine: protectedProcedure.query(({ ctx }) =>
      getUserCareRequests(ctx.user.openId)
    ),
    request: protectedProcedure
      .input(
        z.object({
          category: z.enum([
            "pastoral-conversation",
            "grief",
            "family",
            "youth",
            "addiction",
            "practical-help",
            "other",
          ]),
          message: z.string().min(1).max(12000),
          preferredContact: z.enum(["email", "phone", "in-person"]).optional(),
          safeguardingFlag: z.boolean().default(false),
        })
      )
      .mutation(({ input, ctx }) =>
        createCareRequest({ ...input, userOpenId: ctx.user.openId })
      ),
  }),

  prayer: router({
    mine: protectedProcedure.query(({ ctx }) =>
      getUserPrayerRequests(ctx.user.openId)
    ),
    submitPrivate: protectedProcedure
      .input(
        z.object({
          prayerRequest: z.string().min(1).max(10000),
          isPublic: z.boolean().default(false),
        })
      )
      .mutation(({ input, ctx }) =>
        createPrayerRequest({
          name: ctx.user.name || "NICA member",
          email: ctx.user.email || "",
          ownerOpenId: ctx.user.openId,
          prayerRequest: input.prayerRequest,
          isPublic: input.isPublic,
        })
      ),
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          prayerRequest: z.string().min(1),
          isPublic: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createPrayerRequest({
            name: input.name,
            email: input.email,
            prayerRequest: input.prayerRequest,
            isPublic: input.isPublic ?? false,
          });
          return {
            success: true,
            message: "Prayer request submitted successfully",
          };
        } catch (error) {
          console.error("Prayer request error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to submit prayer request",
          });
        }
      }),
  }),

  donation: router({
    submit: publicProcedure
      .input(
        z.object({
          donorName: z.string().max(120).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          amount: z.number().positive().max(10_000_000),
          currency: z.enum(["KES", "USD"]).default("KES"),
          method: z.enum(["mpesa", "paypal", "stripe", "bank", "inperson"]),
          purpose: z.enum(GIVING_PURPOSE_VALUES),
          project: z.enum(GIVING_PROJECT_VALUES).optional(),
          otherDescription: z.string().max(80).optional(),
          pledgeReference: z.string().max(80).optional(),
          idempotencyKey: z.string().uuid().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const idempotencyKey = input.idempotencyKey ?? newIdempotencyKey();
        if (input.purpose === "project_support" && !input.project) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Select a project for Project Support gifts",
          });
        }
        if (input.purpose !== "project_support" && input.project) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Project selection is only valid for Project Support gifts",
          });
        }
        const givingDescription = buildGivingDescription({
          purpose: input.purpose,
          project: input.project,
          otherDescription: input.otherDescription,
          pledgeReference: input.pledgeReference,
        });
        const mpesaAccountReference = buildMpesaAccountReference({
          purpose: input.purpose,
          project: input.project,
        });
        const provider =
          input.method === "mpesa"
            ? "mpesa"
            : input.method === "paypal"
              ? "paypal"
              : input.method === "stripe"
                ? "stripe"
                : undefined;
        const methodForRecord: "online" | "bank" | "mobile" | "inperson" =
          input.method === "mpesa"
            ? "mobile"
            : input.method === "paypal" || input.method === "stripe"
              ? "online"
              : input.method;
        const donation = await createDonation({
          donorName: input.donorName?.trim() || "Anonymous Donor",
          email: input.email?.trim() || undefined,
          phone: input.phone,
          amount: input.amount,
          currency: input.currency,
          method: methodForRecord,
          provider,
          purpose: givingDescription,
          idempotencyKey,
        });
        if (donation.status === "completed")
          return {
            success: true,
            donationId: donation._id.toString(),
            status: donation.status,
            message: "Donation already completed",
          };
        if (!provider)
          return {
            success: true,
            donationId: donation._id.toString(),
            status: donation.status,
            message: "Donation recorded for manual confirmation",
          };
        if (
          (provider === "paypal" || provider === "stripe") &&
          input.currency !== "USD"
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${provider === "stripe" ? "Stripe" : "PayPal"} donations must use USD`,
          });
        const callbackBaseUrl =
          process.env.PUBLIC_BASE_URL ||
          `${ctx.req.protocol}://${ctx.req.get("host")}`;
        try {
          const payment =
            provider === "mpesa"
              ? await initiateMpesa({
                  amount: input.amount,
                  currency: input.currency,
                  donorName: input.donorName?.trim() || "Anonymous Donor",
                  email: input.email?.trim() || "",
                  phone: input.phone,
                  purpose: givingDescription,
                  callbackBaseUrl,
                  reference: mpesaAccountReference,
                  donationId: donation._id.toString(),
                })
              : provider === "stripe"
                ? await createStripeCheckoutSession({
                    amount: input.amount,
                    currency: input.currency,
                    donorName: input.donorName?.trim() || "Anonymous Donor",
                    email: input.email?.trim() || "",
                    purpose: givingDescription,
                    callbackBaseUrl,
                    reference: mpesaAccountReference,
                    donationId: donation._id.toString(),
                  })
                : await createPaypalOrder({
                    amount: input.amount,
                    currency: input.currency,
                    donorName: input.donorName?.trim() || "Anonymous Donor",
                    email: input.email?.trim() || "",
                    purpose: givingDescription,
                    callbackBaseUrl,
                    reference: idempotencyKey,
                    donationId: donation._id.toString(),
                  });
          await updateDonationProvider(
            donation._id.toString(),
            payment.providerReference
          );
          return {
            success: true,
            donationId: donation._id.toString(),
            status: "pending" as const,
            provider: payment.provider,
            providerReference: payment.providerReference,
            approvalUrl: payment.approvalUrl,
            message: payment.customerMessage,
          };
        } catch (error) {
          await updateDonationStatus(donation._id.toString(), "failed");
          console.error("Donation provider error:", error);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Payment provider is not configured",
          });
        }
      }),
    capturePaypal: publicProcedure
      .input(
        z.object({ donationId: z.string().min(1), orderId: z.string().min(1) })
      )
      .mutation(async ({ input }) => {
        const donation = (await getDonationById(input.donationId)) as any;
        if (
          !donation ||
          donation.provider !== "paypal" ||
          donation.providerReference !== input.orderId
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "This PayPal order is not associated with the donation record",
          });
        }
        const result = await capturePaypalOrder(input.orderId);
        if (result.completed)
          await updateDonationStatus(
            input.donationId,
            "completed",
            result.transactionId
          );
        return {
          success: result.completed,
          status: result.completed
            ? ("completed" as const)
            : ("pending" as const),
          transactionId: result.transactionId,
        };
      }),
  }),

  contact: router({
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
          message: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createContactMessage({
            name: input.name,
            email: input.email,
            phone: input.phone,
            message: input.message,
          });
          return { success: true, message: "Message sent successfully" };
        } catch (error) {
          console.error("Contact message error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send message",
          });
        }
      }),
  }),

  // Events Admin Router
  events: router({
    getPublished: publicProcedure.query(async () => {
      try {
        return await getPublishedEvents();
      } catch (error) {
        console.error("Events fetch error:", error);
        return [];
      }
    }),

    getAll: adminOnly.query(async () => {
      try {
        return await getAllEvents();
      } catch (error) {
        console.error("Events fetch error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),

    create: adminOnly
      .input(
        z.object({
          title: z.string().min(1, "Title is required"),
          description: z.string().optional(),
          eventType: z.enum([
            "service",
            "event",
            "crusade",
            "meeting",
            "other",
          ]),
          startDate: z.date(),
          endDate: z.date().optional(),
          location: z.string().optional(),
          imageUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createEvent(input);
          return { success: true, message: "Event created successfully" };
        } catch (error) {
          console.error("Event creation error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create event",
          });
        }
      }),

    update: adminOnly
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          eventType: z
            .enum(["service", "event", "crusade", "meeting", "other"])
            .optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          location: z.string().optional(),
          imageUrl: z.string().optional(),
          isPublished: z.boolean().optional(),
        })
      )
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
        console.error("Sermons fetch error:", error);
        return [];
      }
    }),

    getAll: adminOnly.query(async () => {
      try {
        return await getAllSermons();
      } catch (error) {
        console.error("Sermons fetch error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),

    create: adminOnly
      .input(
        z.object({
          title: z.string().min(1, "Title is required"),
          speaker: z.string().optional(),
          description: z.string().optional(),
          videoUrl: z.string().optional(),
          audioUrl: z.string().optional(),
          sermonDate: z.date(),
          duration: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createSermon(input);
          return { success: true, message: "Sermon created successfully" };
        } catch (error) {
          console.error("Sermon creation error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create sermon",
          });
        }
      }),

    update: adminOnly
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).optional(),
          speaker: z.string().optional(),
          description: z.string().optional(),
          videoUrl: z.string().url().optional(),
          audioUrl: z.string().url().optional(),
          sermonDate: z.date().optional(),
          duration: z.number().nonnegative().optional(),
          isPublished: z.boolean().optional(),
        })
      )
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
        console.error("Active stream fetch error:", error);
        return null;
      }
    }),

    liveKitStatus: publicProcedure.query(() => ({
      enabled: isLiveKitConfigured(),
    })),

    liveKitViewerToken: publicProcedure
      .input(z.object({ identity: z.string().min(8).max(120) }))
      .query(async ({ input }) => {
        if (!isLiveKitConfigured())
          return { enabled: false as const, isLive: false as const };
        const active = await getActiveStream();
        if (!active) return { enabled: true as const, isLive: false as const };
        try {
          const access = await createLiveKitParticipantToken({
            sessionId: String(active._id),
            identity: `viewer-${input.identity}`,
            name: "NICA viewer",
            role: "viewer",
            roomKind: "program",
          });
          return {
            enabled: true as const,
            isLive: true as const,
            ...access,
            title: active.title,
            description: active.description ?? null,
          };
        } catch (error) {
          console.error("LiveKit viewer token error:", error);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Scalable live streaming is not ready. Please use the standard viewer path while the media service is configured.",
          });
        }
      }),

    liveKitHostToken: adminOnly
      .input(
        z.object({
          sessionId: z.string().min(1),
          identity: z.string().min(8).max(120),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!isLiveKitConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET before using the scalable broadcast path.",
          });
        }
        const active = await getActiveStream();
        if (
          !active ||
          String(active._id) !== input.sessionId ||
          active.status !== "live"
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "The requested broadcast session is not active.",
          });
        }
        try {
          const production = await createLiveKitParticipantToken({
            sessionId: input.sessionId,
            identity: `director-${ctx.user.openId}-${input.identity}`,
            name: ctx.user.name || "NICA director",
            role: "director",
            roomKind: "production",
          });
          const program = await createLiveKitParticipantToken({
            sessionId: input.sessionId,
            identity: `director-program-${ctx.user.openId}-${input.identity}`,
            name: ctx.user.name || "NICA director",
            role: "director",
            roomKind: "program",
          });
          return { ...program, production, program };
        } catch (error) {
          console.error("LiveKit host token error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to prepare the scalable broadcast room.",
          });
        }
      }),

    createCameraInvitation: adminOnly
      .input(
        z.object({
          sessionId: z.string().min(1),
          label: z.string().trim().min(1).max(80),
          expiresInMinutes: z.number().int().min(5).max(720).default(240),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const active = await getActiveStream();
        if (
          !active ||
          String(active._id) !== input.sessionId ||
          active.status !== "live"
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Start the broadcast before creating a mobile camera invite.",
          });
        }
        const result = await createProductionCameraInvitation({
          sessionId: input.sessionId,
          label: input.label,
          createdByOpenId: ctx.user.openId,
          expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
        });
        return {
          id: String(result.invitation._id),
          label: result.invitation.label,
          expiresAt: result.invitation.expiresAt,
          inviteToken: result.code,
        };
      }),

    listCameraInvitations: adminOnly
      .input(z.object({ sessionId: z.string().min(1) }))
      .query(async ({ input }) =>
        listProductionCameraInvitations(input.sessionId)
      ),

    revokeCameraInvitation: adminOnly
      .input(
        z.object({
          sessionId: z.string().min(1),
          invitationId: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const result = await revokeProductionCameraInvitation(
          input.invitationId,
          input.sessionId
        );
        if (!result)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Camera invite not found or already inactive.",
          });
        return result;
      }),

    acceptCameraInvitation: publicProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          inviteToken: z.string().min(20).max(200),
          deviceName: z.string().trim().min(1).max(80),
        })
      )
      .mutation(async ({ input }) => {
        if (!isLiveKitConfigured())
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Scalable camera production is not configured.",
          });
        const active = await getActiveStream();
        if (
          !active ||
          String(active._id) !== input.sessionId ||
          active.status !== "live"
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "The broadcast is not live.",
          });
        }
        const invitation = await acceptProductionCameraInvitation({
          sessionId: input.sessionId,
          code: input.inviteToken,
          deviceName: input.deviceName,
        });
        if (!invitation)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This camera invitation is invalid, expired, or revoked.",
          });
        try {
          const access = await createLiveKitParticipantToken({
            sessionId: input.sessionId,
            identity: `contributor-${String(invitation._id)}`,
            name: invitation.acceptedDeviceName || invitation.label,
            role: "contributor",
            roomKind: "production",
          });
          return {
            ...access,
            invitationId: String(invitation._id),
            label: invitation.label,
          };
        } catch (error) {
          console.error("LiveKit contributor token error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to prepare the contributor camera room.",
          });
        }
      }),

    contributorHeartbeat: publicProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          invitationId: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const result = await touchProductionCameraInvitation(
          input.invitationId,
          input.sessionId
        );
        if (!result)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This contributor invitation is no longer active.",
          });
        return { ok: true };
      }),

    getSessions: adminOnly.query(async () => {
      try {
        return await getStreamingSessions();
      } catch (error) {
        console.error("Streaming sessions fetch error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),

    createSession: adminOnly
      .input(
        z.object({
          title: z.string().min(1, "Title is required"),
          description: z.string().optional(),
          startTime: z.date(),
          endTime: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const sessionId = await createStreamingSession(input);
          return {
            success: true,
            message: "Streaming session created successfully",
            sessionId,
          };
        } catch (error) {
          console.error("Streaming session creation error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create streaming session",
          });
        }
      }),

    // Creates a session and marks it live in one step — this is what the
    // admin's "Go Live" button calls.
    goLive: adminOnly
      .input(
        z.object({
          title: z.string().min(1, "Title is required"),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const existing = await getActiveStream();
          if (existing) await updateStreamStatus(String(existing._id), "ended");
          const sessionId = await createStreamingSession({
            title: input.title,
            description: input.description,
            startTime: new Date(),
            status: "live",
          });
          return { success: true, sessionId };
        } catch (error) {
          console.error("Go live error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start live session",
          });
        }
      }),

    // Marks a session as ended — called when the admin clicks "Stop Live"
    // and also by the signaling server if the admin disconnects unexpectedly.
    endLive: adminOnly
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          await updateStreamStatus(input.sessionId, "ended");
          return { success: true };
        } catch (error) {
          console.error("End live error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to end live session",
          });
        }
      }),

    getPlatforms: adminOnly.query(async () => {
      try {
        return await getActivePlatformConnections();
      } catch (error) {
        console.error("Platforms fetch error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),

    addPlatform: adminOnly
      .input(
        z.object({
          platform: z.enum(["youtube", "instagram"]),
          accountName: z.string().min(1),
          accessToken: z.string().min(1),
          refreshToken: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createPlatformConnection(input);
          return { success: true, message: "Platform connected successfully" };
        } catch (error) {
          console.error("Platform connection error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to connect platform",
          });
        }
      }),

    removePlatform: adminOnly
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        try {
          await deactivatePlatformConnection(input.id);
          return { success: true, message: "Platform disconnected" };
        } catch (error) {
          console.error("Platform disconnect error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to disconnect platform",
          });
        }
      }),

    getCameras: adminOnly.query(async () => {
      try {
        return await getAvailableCameras();
      } catch (error) {
        console.error("Cameras fetch error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),

    registerCamera: adminOnly
      .input(
        z.object({
          name: z.string().min(1),
          deviceId: z.string().min(1),
          type: z.enum(["webcam", "external", "phone", "other"]),
          resolution: z.string().optional(),
          frameRate: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await registerCameraDevice(input);
          return { success: true, message: "Camera registered successfully" };
        } catch (error) {
          console.error("Camera registration error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to register camera",
          });
        }
      }),

    // Restream multi-platform broadcasting
    startMultiPlatformBroadcast: adminOnly
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          platforms: z.array(z.enum(["youtube", "instagram"])),
        })
      )
      .mutation(async ({ input }) => {
        try {
          if (!restreamService) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Restream is not configured. Add RESTREAM_API_KEY and connect a destination before starting an external broadcast.",
            });
          }

          const broadcast = await restreamService.createBroadcast(
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
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start broadcast",
          });
        }
      }),

    stopMultiPlatformBroadcast: adminOnly
      .input(z.object({ broadcastId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          if (!restreamService) {
            return {
              success: true,
              message:
                "No external broadcast was active because Restream is not configured",
            };
          }
          await restreamService.stopBroadcast(input.broadcastId);
          return { success: true, message: "Multi-platform broadcast stopped" };
        } catch (error) {
          console.error("Stop broadcast error:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
      }),
  }),

  adminContent: router({
    getPrayerRequests: adminOnly.query(() => getPrayerRequests()),
    updatePrayerRequestStatus: adminOnly
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["pending", "approved", "archived"]),
        })
      )
      .mutation(({ input }) =>
        updatePrayerRequestStatus(input.id, input.status)
      ),
    getDonations: adminOnly.query(() => getDonations()),
    updateDonationStatus: adminOnly
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["pending", "completed", "failed"]),
          transactionId: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        updateDonationStatus(input.id, input.status, input.transactionId)
      ),
    getContactMessages: adminOnly.query(() => getContactMessages()),
    getCareRequests: adminOnly.query(() => getCareRequests()),
    getCareCaseNotes: adminOnly
      .input(z.object({ id: z.string().min(1) }))
      .query(({ input }) => getCareCaseNotes(input.id)),
    getCareCaseActivity: adminOnly
      .input(z.object({ id: z.string().min(1) }))
      .query(({ input }) => getCareCaseActivity(input.id)),
    addCareCaseNote: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          content: z.string().min(1).max(12000),
        })
      )
      .mutation(({ input, ctx }) =>
        addCareCaseNote({
          careRequestId: input.id,
          authorOpenId: ctx.user.openId,
          content: input.content,
        })
      ),
    assignCareRequest: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          assignedToOpenId: z.string().min(1).nullable(),
        })
      )
      .mutation(({ input, ctx }) =>
        assignCareRequest({ ...input, actorOpenId: ctx.user.openId })
      ),
    updateCareCase: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          status: z
            .enum(["new", "assigned", "in-progress", "closed", "escalated"])
            .optional(),
          priority: z.enum(["routine", "high", "urgent"]).optional(),
          dueAt: z.date().nullable().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateCareRequestCase({ ...input, actorOpenId: ctx.user.openId })
      ),
    updateCareRequestStatus: adminOnly
      .input(
        z.object({
          id: z.string().min(1),
          status: z.enum([
            "new",
            "assigned",
            "in-progress",
            "closed",
            "escalated",
          ]),
        })
      )
      .mutation(({ input, ctx }) =>
        updateCareRequestCase({
          id: input.id,
          actorOpenId: ctx.user.openId,
          status: input.status,
        })
      ),
    updateContactMessageStatus: adminOnly
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["new", "read", "responded"]),
        })
      )
      .mutation(({ input }) =>
        updateContactMessageStatus(input.id, input.status)
      ),
  }),

  // Dashboard Stats Router
  dashboard: router({
    getStats: adminOnly.query(() => getDashboardStats()),
  }),
});

export type AppRouter = typeof appRouter;
