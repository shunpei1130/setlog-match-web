import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { authSessions } from "../../../../db/schema";
import { AUTH_COOKIE_NAME, clearAuthCookie } from "../../../../lib/auth";
import { hashSecret } from "../../../../lib/crypto";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  try {
    if (rawToken) {
      const db = getDb();
      await db.delete(authSessions).where(eq(authSessions.tokenHash, hashSecret(rawToken)));
    }
  } catch {
    // Always clear the browser cookie even when the database is unavailable.
  }
  const response = NextResponse.json({ signedOut: true });
  clearAuthCookie(response);
  return response;
}
