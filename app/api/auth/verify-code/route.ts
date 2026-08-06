import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { authenticationCodes, users } from "../../../../db/schema";
import { createAuthSession, setAuthCookie } from "../../../../lib/auth";
import {
  AUTH_CODE_MAX_ATTEMPTS,
  hashSecret,
  safeSecretEqual,
} from "../../../../lib/crypto";
import { normalizeAoyamaEmail } from "../../../../lib/school-email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  const email = normalizeAoyamaEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email) return NextResponse.json({ error: "AOYAMA_EMAIL_REQUIRED" }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "AUTH_CODE_INVALID" }, { status: 400 });

  try {
    const db = getDb();
    const [challenge] = await db
      .select()
      .from(authenticationCodes)
      .where(and(
        eq(authenticationCodes.email, email),
        isNull(authenticationCodes.consumedAt),
      ))
      .orderBy(desc(authenticationCodes.createdAt))
      .limit(1);

    if (!challenge || challenge.expiresAt <= new Date()) {
      return NextResponse.json({ error: "AUTH_CODE_EXPIRED" }, { status: 400 });
    }
    if (challenge.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      return NextResponse.json({ error: "AUTH_CODE_LOCKED" }, { status: 429 });
    }

    if (!safeSecretEqual(challenge.codeHash, hashSecret(code))) {
      const [updated] = await db.update(authenticationCodes)
        .set({ attempts: sql`${authenticationCodes.attempts} + 1` })
        .where(and(
          eq(authenticationCodes.id, challenge.id),
          lt(authenticationCodes.attempts, AUTH_CODE_MAX_ATTEMPTS),
        ))
        .returning({ attempts: authenticationCodes.attempts });
      if (!updated) return NextResponse.json({ error: "AUTH_CODE_LOCKED" }, { status: 429 });
      return NextResponse.json({ error: "AUTH_CODE_INVALID" }, { status: 400 });
    }

    const now = new Date();
    await db.update(authenticationCodes)
      .set({ consumedAt: now })
      .where(eq(authenticationCodes.id, challenge.id));

    const [user] = await db
      .insert(users)
      .values({ email, emailVerifiedAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: users.email,
        set: { emailVerifiedAt: now, updatedAt: now },
      })
      .returning({ id: users.id, email: users.email, lineFollowed: users.lineFollowed });

    if (!user) throw new Error("User could not be created.");
    const session = await createAuthSession(db, user.id);
    const response = NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email, lineFollowed: user.lineFollowed },
    });
    setAuthCookie(response, session.rawToken);
    return response;
  } catch {
    return NextResponse.json({ error: "AUTH_VERIFICATION_UNAVAILABLE" }, { status: 503 });
  }
}
