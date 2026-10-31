import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createAuthSession, setAuthCookie } from "../../../../lib/auth";
import { verifyLineIdToken } from "../../../../lib/line";

export const runtime = "nodejs";

// Exchanges a LIFF ID token for the regular app session. The token is
// verified with LINE (client_id = LINE_CHANNEL_ID), the user is found by
// line_user_id, and from then on the normal auth cookie flow applies.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { idToken?: unknown } | null;
  if (!body || typeof body.idToken !== "string" || body.idToken.length === 0) {
    return NextResponse.json({ error: "ID_TOKEN_REQUIRED" }, { status: 400 });
  }
  let lineUserId: string;
  try {
    const verified = await verifyLineIdToken(body.idToken);
    lineUserId = verified.sub;
  } catch {
    return NextResponse.json({ error: "ID_TOKEN_INVALID" }, { status: 401 });
  }
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.lineUserId, lineUserId))
    .limit(1);
  if (!user) return NextResponse.json({ error: "LINE_USER_NOT_REGISTERED" }, { status: 404 });
  const { rawToken } = await createAuthSession(db, user.id);
  const response = NextResponse.json({ user: { email: user.email } });
  setAuthCookie(response, rawToken);
  return response;
}
