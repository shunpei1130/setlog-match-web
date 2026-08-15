import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { getApiAuthUser } from "../../../../../lib/auth";
import { ensureEvent } from "../../../../../lib/event-registration";
import { getPublishedPairForUser } from "../../../../../lib/pair";
import { readVisitorId, recordFunnelEvent } from "../../../../../lib/analytics";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { eventKey } = await params;
  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const pair = await getPublishedPairForUser(db, event.eventKey, user.id);
    if (!pair) return NextResponse.json({ error: "PAIR_NOT_PUBLISHED" }, { status: 404 });
    await recordFunnelEvent(db, request, "event_activated", {
      userId: user.id,
      eventId: event.id,
      visitorId: readVisitorId(request) ?? user.id,
      dedupeKey: `event_activated:${event.id}:${user.id}`,
    });
    return NextResponse.json({ pair });
  } catch {
    return NextResponse.json({ error: "PAIR_UNAVAILABLE" }, { status: 503 });
  }
}
