import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { eventPairs, safetyReports } from "../../../../../db/schema";
import { getApiAuthUser } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pairId: string }> },
) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { reason?: unknown; detail?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 1000) : null;
  if (!reason || reason.length > 120) return NextResponse.json({ error: "REPORT_REASON_REQUIRED" }, { status: 400 });
  const { pairId } = await params;
  try {
    const db = getDb();
    const [pair] = await db.select().from(eventPairs).where(eq(eventPairs.id, pairId)).limit(1);
    if (!pair || (pair.participantAId !== user.id && pair.participantBId !== user.id)) {
      return NextResponse.json({ error: "PAIR_NOT_FOUND" }, { status: 404 });
    }
    await db.insert(safetyReports).values({ pairId, reporterUserId: user.id, reason, detail });
    await db.update(eventPairs).set({ status: "blocked", updatedAt: new Date() }).where(eq(eventPairs.id, pairId));
    return NextResponse.json({ reported: true });
  } catch {
    return NextResponse.json({ error: "REPORT_UNAVAILABLE" }, { status: 503 });
  }
}
