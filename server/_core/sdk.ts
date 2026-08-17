import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { IUser } from "../models";
import * as db from "../db";
import { ENV } from "./env";

const scrypt = promisify(scryptCallback);
const DEVELOPMENT_SESSION_SECRET = "nica-local-development-session-secret";

type SessionRole = "user" | "admin";

export type SessionPayload = {
  openId: string;
  name: string;
  role: SessionRole;
};

export type AuthenticatedUser = IUser & {
  taskUid?: string;
  isCron?: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicUser(user: IUser) {
  const safeUser = { ...(user as any) };
  delete safeUser.passwordHash;
  delete safeUser.passwordSalt;
  return safeUser as Omit<IUser, "passwordHash" | "passwordSalt">;
}

function getSessionSecret(): Uint8Array {
  const secret = ENV.cookieSecret || DEVELOPMENT_SESSION_SECRET;
  if (ENV.isProduction && !ENV.cookieSecret) {
    throw new Error("JWT_SECRET must be configured in production");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<{
  passwordHash: string;
  passwordSalt: string;
}> {
  const passwordSalt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, passwordSalt, 64)) as Buffer;
  return {
    passwordHash: derivedKey.toString("hex"),
    passwordSalt,
  };
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
  passwordSalt: string
): Promise<boolean> {
  const derivedKey = (await scrypt(password, passwordSalt, 64)) as Buffer;
  const expected = Buffer.from(passwordHash, "hex");
  return (
    expected.length === derivedKey.length &&
    timingSafeEqual(expected, derivedKey)
  );
}

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(Object.entries(parseCookieHeader(cookieHeader)));
}

class LocalAuthService {
  async createSessionToken(
    user: Pick<IUser, "openId" | "name" | "role">,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const payload: SessionPayload = {
      openId: user.openId,
      name: user.name || "NICA member",
      role: user.role,
    };

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(expirationSeconds)
      .sign(getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, name, role } = payload as Record<string, unknown>;
      if (
        typeof openId !== "string" ||
        !openId ||
        typeof name !== "string" ||
        !["user", "admin"].includes(String(role))
      ) {
        return null;
      }
      return { openId, name, role: role as SessionRole };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = parseCookies(req.headers.cookie);
    const session = await this.verifySession(cookies.get(COOKIE_NAME));
    if (!session) throw new Error("Invalid or missing session");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw new Error("Authenticated user was not found");
    return user as AuthenticatedUser;
  }
}

export const sdk = new LocalAuthService();
