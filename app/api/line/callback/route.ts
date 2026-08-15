import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { lineLoginStates, users } from "../../../../db/schema";
import { getCurrentAuthUser } from "../../../../lib/auth";
import { hashSecret, safeSecretEqual } from "../../../../lib/crypto";
import { checkLineFriendship, exchangeLineCode, getLineProfile } from "../../../../lib/line";
import { readVisitorId, recordFunnelEvent } from "../../../../lib/analytics";

export const runtime = "nodejs";

type CallbackTarget = { kind: "web" | "mobile"; userId: string };

function redirectFor(request: Request, kind: CallbackTarget["kind"], status: string) {
  if (kind === "mobile") {
    return NextResponse.redirect(new URL(`setmob://line-callback?status=${encodeURIComponent(status)}`));
  }
  return NextResponse.redirect(new URL(`/?line=${encodeURIComponent(status)}`, request.url));
}

async function resolveCallbackTarget(state: string): Promise<CallbackTarget | null> {
  if (state.startsWith("m_")) {
    const now = new Date();
    const [mobileState] = await getDb()
      .update(lineLoginStates)
      .set({ consumedAt: now })
      .where(and(
        eq(lineLoginStates.stateHash, hashSecret(state)),
        gt(lineLoginStates.expiresAt, now),
        isNull(lineLoginStates.consumedAt),
      ))
      .returning({ userId: lineLoginStates.userId });
    return mobileState ? { kind: "mobile", userId: mobileState.userId } : null;
  }

  const user = await getCurrentAuthUser();
  if (!user) return null;
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("setlog_line_state")?.value;
  if (!expectedState || !safeSecretEqual(expectedState, state)) return null;
  return { kind: "web", userId: user.id };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const requestedKind = state?.startsWith("m_") ? "mobile" : "web";
  if (!state) return redirectFor(request, requestedKind, "invalid-state");

  let target: CallbackTarget | null = null;
  try {
    target = await resolveCallbackTarget(state);
  } catch {
    return redirectFor(request, requestedKind, "unavailable");
  }
  if (!target) return redirectFor(request, requestedKind, requestedKind === "mobile" ? "expired" : "invalid-state");
  if (error || !code) return redirectFor(request, target.kind, "cancelled");

  try {
    const token = await exchangeLineCode(code);
    const profile = await getLineProfile(token.access_token);
    const followed = await checkLineFriendship(profile.userId);
    const db = getDb();
    const existing = await db.query.users.findFirst({ where: eq(users.lineUserId, profile.userId) });
    if (existing && existing.id !== target.userId) {
      return redirectFor(request, target.kind, "already-linked");
    }
    await db.update(users)
      .set({
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName ?? null,
        lineFollowed: followed,
        lineLinkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.userId));
    const visitorId = readVisitorId(request) ?? target.userId;
    await recordFunnelEvent(db, request, "line_linked", {
      userId: target.userId,
      visitorId,
      dedupeKey: `line_linked:${target.userId}`,
    });
    if (followed) await recordFunnelEvent(db, request, "line_followed", {
      userId: target.userId,
      visitorId,
      dedupeKey: `line_followed:${target.userId}`,
    });
    const response = redirectFor(request, target.kind, followed ? "linked" : "linked-not-following");
    if (target.kind === "web") {
      response.headers.append("Set-Cookie", "setlog_line_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;");
    }
    return response;
  } catch {
    return redirectFor(request, target.kind, "unavailable");
  }
}
