import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { getApiAuthUser } from "../../../../../lib/auth";
import { LifecycleError, saveSetlogInvite, confirmSetlogJoined } from "../../../../../lib/lifecycle";
import { getPairViewForUser } from "../../../../../lib/pair";

export const runtime = "nodejs";
async function update(request: Request, params: Promise<{ pairId: string }>, joined: boolean) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { pairId } = await params;
  try {
    if (joined) await confirmSetlogJoined(pairId, user.id);
    else {
      const body = await request.json().catch(() => null);
      await saveSetlogInvite(pairId, user.id, body?.invite);
    }
    return NextResponse.json({ pair: await getPairViewForUser(getDb(), pairId, user.id) });
  } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "SETLOG_INVITE_UNAVAILABLE" }, { status: 503 });
  }
}
export async function PUT(request: Request, { params }: { params: Promise<{ pairId: string }> }) { return update(request, params, false); }
export async function POST(request: Request, { params }: { params: Promise<{ pairId: string }> }) { return update(request, params, true); }
