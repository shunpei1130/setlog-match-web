import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { getCurrentAuthUser } from "../../../../../lib/auth";
import { getPairViewForUser, recordDecision, recordDisclosuresForUser, validateDecision } from "../../../../../lib/pair";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pairId: string }> },
) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { pairId } = await params;
  const decision = validateDecision(await request.json().catch(() => null));
  if (!decision) return NextResponse.json({ error: "DECISION_REQUIRED" }, { status: 400 });

  if (decision.instagram && !user.instagramHandle) {
    return NextResponse.json({ error: "INSTAGRAM_CONTACT_REQUIRED" }, { status: 400 });
  }
  if (decision.line && !user.lineContact) {
    return NextResponse.json({ error: "LINE_CONTACT_REQUIRED" }, { status: 400 });
  }

  try {
    const db = getDb();
    const before = await getPairViewForUser(db, pairId, user.id);
    if (!before || before.status !== "published") return NextResponse.json({ error: "PAIR_NOT_AVAILABLE" }, { status: 404 });
    await recordDecision(db, pairId, user.id, decision);
    const after = await getPairViewForUser(db, pairId, user.id);
    if (!after) return NextResponse.json({ error: "PAIR_NOT_FOUND" }, { status: 404 });

    if (after.result?.kind === "disclosed") {
      await recordDisclosuresForUser(db, pairId, user.id, after.result.items);
    }
    return NextResponse.json({ result: after.result, pair: after });
  } catch {
    return NextResponse.json({ error: "DECISION_UNAVAILABLE" }, { status: 503 });
  }
}
