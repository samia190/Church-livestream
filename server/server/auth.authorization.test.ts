import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextWithUser(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("authorization boundaries", () => {
  it("rejects anonymous access to admin statistics", async () => {
    const caller = appRouter.createCaller(contextWithUser(null));
    await expect(caller.dashboard.getStats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects ordinary users from admin statistics", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      _id: "user-id" as any,
      openId: "user-open-id",
      name: "User",
      email: "user@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any));
    await expect(caller.dashboard.getStats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
