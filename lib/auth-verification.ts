import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { authenticationCodes, users } from "../db/schema";
import { createAuthSession } from "./auth";
import { AUTH_CODE_MAX_ATTEMPTS, hashSecret, safeSecretEqual } from "./crypto";
import { normalizeAllowedAuthEmail } from "./auth-email";

type VerificationFailure = {
  ok: false;
  error: "AOYAMA_EMAIL_REQUIRED" | "AUTH_CODE_INVALID" | "AUTH_CODE_EXPIRED" | "AUTH_CODE_LOCKED";
  status: 400 | 429;
};

type VerificationSuccess = {
  ok: true;
  user: { id: string; email: string; lineFollowed: boolean };
  session: { rawToken: string; sessionId: string; expiresAt: Date };
};

export async function verifyAuthenticationCode(
  emailInput: unknown,
  codeInput: unknown,
): Promise<VerificationFailure | VerificationSuccess> {
  const email = normalizeAllowedAuthEmail(emailInput);
  const code = typeof codeInput === "string" ? codeInput.trim() : "";
  if (!email) return { ok: false, error: "AOYAMA_EMAIL_REQUIRED", status: 400 };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "AUTH_CODE_INVALID", status: 400 };

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
    return { ok: false, error: "AUTH_CODE_EXPIRED", status: 400 };
  }
  if (challenge.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
    return { ok: false, error: "AUTH_CODE_LOCKED", status: 429 };
  }

  if (!safeSecretEqual(challenge.codeHash, hashSecret(code))) {
    const [updated] = await db.update(authenticationCodes)
      .set({ attempts: sql`${authenticationCodes.attempts} + 1` })
      .where(and(
        eq(authenticationCodes.id, challenge.id),
        lt(authenticationCodes.attempts, AUTH_CODE_MAX_ATTEMPTS),
      ))
      .returning({ attempts: authenticationCodes.attempts });
    if (!updated) return { ok: false, error: "AUTH_CODE_LOCKED", status: 429 };
    return { ok: false, error: "AUTH_CODE_INVALID", status: 400 };
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
  return { ok: true, user, session };
}
