import { describe, expect, it } from "vitest";
import {
  hashPassword,
  sdk,
  toPublicUser,
  verifyPassword,
} from "./_core/sdk";

describe("first-party authentication", () => {
  it("hashes passwords with a unique salt and verifies only the correct password", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");

    expect(first.passwordSalt).not.toBe(second.passwordSalt);
    expect(first.passwordHash).not.toBe("correct horse battery staple");
    await expect(
      verifyPassword(
        "correct horse battery staple",
        first.passwordHash,
        first.passwordSalt
      )
    ).resolves.toBe(true);
    await expect(
      verifyPassword("wrong password", first.passwordHash, first.passwordSalt)
    ).resolves.toBe(false);
  });

  it("signs and verifies a local session without external identity services", async () => {
    const token = await sdk.createSessionToken({
      openId: "local_test_user",
      name: "Local User",
      role: "user",
    });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({
      openId: "local_test_user",
      name: "Local User",
      role: "user",
    });
  });

  it("redacts password credentials from public user responses", () => {
    const user = {
      openId: "local_test_user",
      name: "Local User",
      email: "local@example.com",
      loginMethod: "local",
      passwordHash: "hash",
      passwordSalt: "salt",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const safeUser = toPublicUser(user as any) as Record<string, unknown>;
    expect(safeUser.passwordHash).toBeUndefined();
    expect(safeUser.passwordSalt).toBeUndefined();
    expect(safeUser.email).toBe("local@example.com");
  });
});
