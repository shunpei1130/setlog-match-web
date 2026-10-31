import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { getApiAuthUser } from "../../../../../lib/auth";
import { LifecycleError, saveSetlogInvite, confirmSetlogJoined } from "../../../../../lib/lifecycle";
import { getPairViewForUser } from "../../../../../lib/pair";
import { notifyInviteJoined, notifyPartnerInviteShared } from "../../../../../lib/invite-notifications";

export const runtime = "nodejs";
async function update(request: Request, params: Promise<{ pairId: string }>, joined: boolean) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { pairId } = await params;
  try {
    const db = getDb();
    const before = await getPairViewForUser(db, pairId, user.id);
    if (joined) await confirmSetlogJoined(pairId, user.id);
    else {
      const body = await request.json().catch(() => null);
      await saveSetlogInvite(pairId, user.id, body?.invite);
    }
    const pair = await getPairViewForUser(db, pairId, user.id);
    // Notifications are failure-isolated helpers: they never change the
    // outcome of the save / confirmation above. Only actual transitions
    // notify (a new or replaced invite code, a first join confirmation).
    if (joined) {
      if (before && pair && !before.invite.joined && pair.invite.joined) {
        await notifyInviteJoined(pairId, user.id);
      }
    } else if (pair?.setlogCode && pair.setlogCode !== before?.setlogCode) {
      await notifyPartnerInviteShared(pairId, user.id);
    }
    return NextResponse.json({ pair });
  } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "SETLOG_INVITE_UNAVAILABLE" }, { status: 503 });
  }
}
export async function PUT(request: Request, { params }: { params: Promise<{ pairId: string }> }) { return update(request, params, false); }
export async function POST(request: Request, { params }: { params: Promise<{ pairId: string }> }) { return update(request, params, true); }
