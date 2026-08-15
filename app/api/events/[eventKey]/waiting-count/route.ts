import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { ensureEvent, eventState, getWaitingCount } from "../../../../../lib/event-registration";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const count = await getWaitingCount(db, event.id);

    return NextResponse.json({
      ...eventState(event),
      count,
      capacity: event.capacity,
      remaining: Math.max(0, event.capacity - count),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "WAITING_COUNT_UNAVAILABLE" }, { status: 503 });
  }
}
