import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getDb } from "../db";
import { authSessions, users } from "../db/schema";
import { generateSessionToken, hashSecret, AUTH_SESSION_TTL_SECONDS } from "./crypto";

export const AUTH_COOKIE_NAME = "setlog_auth_session";

export type AuthUser = {
  id: string;
  email: string;
  lineUserId: string | null;
  lineFollowed: boolean;
  instagramHandle: string | null;
  lineContact: string | null;
  sessionId: string;
};

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(authorization);
  return match?.[1] ?? null;
}

function cookieOptions(maxAge: number) {
  return [
    `Path=/`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

async function getAuthUserByToken(rawToken: string | null): Promise<AuthUser | null> {
  if (!rawToken) return null;

  try {
    const db = getDb();
    const [result] = await db
      .select({
        sessionId: authSessions.id,
        userId: users.id,
        email: users.email,
        lineUserId: users.lineUserId,
        lineFollowed: users.lineFollowed,
        instagramHandle: users.instagramHandle,
        lineContact: users.lineContact,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(and(
        eq(authSessions.tokenHash, hashSecret(rawToken)),
        gt(authSessions.expiresAt, new Date()),
      ))
      .limit(1);

    if (!result) return null;

    await db
      .update(authSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(authSessions.id, result.sessionId));

    return {
      id: result.userId,
      email: result.email,
      lineUserId: result.lineUserId,
      lineFollowed: result.lineFollowed,
      instagramHandle: result.instagramHandle,
      lineContact: result.lineContact,
      sessionId: result.sessionId,
    };
  } catch {
    return null;
  }
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return getAuthUserByToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);
}

export async function getApiAuthUser(request: Request): Promise<AuthUser | null> {
  if (request.headers.has("authorization")) {
    return getAuthUserByToken(getBearerToken(request));
  }
  return getCurrentAuthUser();
}

export async function revokeAuthToken(rawToken: string) {
  const db = getDb();
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashSecret(rawToken)));
}

export async function createAuthSession(db: ReturnType<typeof getDb>, userId: string) {
  const rawToken = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_SECONDS * 1000);
  const [session] = await db
    .insert(authSessions)
    .values({
      userId,
      tokenHash: hashSecret(rawToken),
      expiresAt,
      lastSeenAt: now,
    })
    .returning({ id: authSessions.id });
  if (!session) throw new Error("Auth session could not be created.");
  return { rawToken, sessionId: session.id, expiresAt };
}

export function setAuthCookie(response: NextResponse, rawToken: string) {
  response.headers.append("Set-Cookie", `${AUTH_COOKIE_NAME}=${rawToken}; ${cookieOptions(AUTH_SESSION_TTL_SECONDS)}`);
}

export function clearAuthCookie(response: NextResponse) {
  response.headers.append("Set-Cookie", `${AUTH_COOKIE_NAME}=; ${cookieOptions(0)}`);
}

export function isAdminEmail(email: string) {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
