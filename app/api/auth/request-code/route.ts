import { and, desc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { authenticationCodes } from "../../../../db/schema";
import {
  AUTH_CODE_RESEND_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  generateAuthCode,
  hashSecret,
} from "../../../../lib/crypto";
import { sendVerificationCode } from "../../../../lib/email";
import { normalizeAllowedAuthEmail } from "../../../../lib/auth-email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = normalizeAllowedAuthEmail(body?.email);
  if (!email) return NextResponse.json({ error: "AOYAMA_EMAIL_REQUIRED" }, { status: 400 });

  try {
    const db = getDb();
    const resendAfter = new Date(Date.now() - AUTH_CODE_RESEND_SECONDS * 1000);
    const [recent] = await db
      .select({ createdAt: authenticationCodes.createdAt })
      .from(authenticationCodes)
      .where(and(eq(authenticationCodes.email, email), gt(authenticationCodes.createdAt, resendAfter)))
      .orderBy(desc(authenticationCodes.createdAt))
      .limit(1);

    if (recent) {
      return NextResponse.json({
        sent: true,
        retryAfter: Math.max(1, Math.ceil((recent.createdAt.getTime() + AUTH_CODE_RESEND_SECONDS * 1000 - Date.now()) / 1000)),
        expiresIn: AUTH_CODE_TTL_SECONDS,
      });
    }

    const code = generateAuthCode();
    await db.insert(authenticationCodes).values({
      email,
      codeHash: hashSecret(code),
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    });
    await sendVerificationCode({ email, code });

    return NextResponse.json({ sent: true, expiresIn: AUTH_CODE_TTL_SECONDS });
  } catch {
    return NextResponse.json({ error: "AUTH_CODE_UNAVAILABLE" }, { status: 503 });
  }
}
