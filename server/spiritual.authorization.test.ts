import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("spiritual feature authorization", () => {
  it("keeps private spiritual records behind authentication", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.welcome.progress()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.journal.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.prayer.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.care.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.service.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.prayerRoom.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.prayerRoom.status({ sessionId: "example" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.prayerRoom.join({ sessionId: "example" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.notifications.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.circles.requests({ circleId: "example" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.streaming.liveKitHostToken({ sessionId: "example", identity: "anonymous-viewer" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("keeps public pathway discovery available without exposing private progress", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    const paths = await caller.welcome.paths();
    expect(paths.length).toBeGreaterThan(0);
    const liveKitStatus = await caller.streaming.liveKitStatus();
    expect(typeof liveKitStatus.enabled).toBe("boolean");
    await expect(caller.circles.requestMembership({ circleId: "example" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.adminPrayerRoom.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.adminCircles.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.adminService.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
