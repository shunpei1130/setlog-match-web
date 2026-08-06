import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getCurrentAuthUser } from "../../../../lib/auth";
import { safeSecretEqual } from "../../../../lib/crypto";
import { checkLineFriendship, exchangeLineCode, getLineProfile } from "../../../../lib/line";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.redirect(new URL("/?line=auth-required", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error || !code || !state) return NextResponse.redirect(new URL("/?line=cancelled", request.url));

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("setlog_line_state")?.value;
  if (!expectedState || !safeSecretEqual(expectedState, state)) {
    return NextResponse.redirect(new URL("/?line=invalid-state", request.url));
  }

  try {
    const token = await exchangeLineCode(code);
    const profile = await getLineProfile(token.access_token);
    const followed = await checkLineFriendship(profile.userId);
    const db = getDb();
    const existing = await db.query.users.findFirst({ where: eq(users.lineUserId, profile.userId) });
    if (existing && existing.id !== user.id) {
      return NextResponse.redirect(new URL("/?line=already-linked", request.url));
    }
    await db.update(users)
      .set({
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName ?? null,
        lineFollowed: followed,
        lineLinkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    const response = NextResponse.redirect(new URL(`/?line=${followed ? "linked" : "linked-not-following"}`, request.url));
    response.headers.append("Set-Cookie", "setlog_line_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?line=unavailable", request.url));
  }
}
