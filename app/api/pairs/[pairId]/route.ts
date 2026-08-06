import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { getCurrentAuthUser } from "../../../../lib/auth";
import { getPairViewForUser } from "../../../../lib/pair";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pairId: string }> },
) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { pairId } = await params;
  try {
    const pair = await getPairViewForUser(getDb(), pairId, user.id);
    if (!pair) return NextResponse.json({ error: "PAIR_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ pair });
  } catch {
    return NextResponse.json({ error: "PAIR_UNAVAILABLE" }, { status: 503 });
  }
}
