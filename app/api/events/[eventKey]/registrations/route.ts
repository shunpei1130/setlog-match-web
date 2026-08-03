import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { eventRegistrations } from "../../../../../db/schema";
import { ensureEvent, getWaitingCount } from "../../../../../lib/event-registration";
import { getOrCreateSessionId, setSessionCookie } from "../../../../../lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;
  const body = await request.json().catch(() => null) as { lineRegistered?: boolean } | null;

  if (body?.lineRegistered !== true) {
    return NextResponse.json({ error: "LINE_REGISTRATION_REQUIRED" }, { status: 400 });
  }

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const { sessionId, shouldSetCookie } = await getOrCreateSessionId();
    const now = new Date();

    await db
      .insert(eventRegistrations)
      .values({
        eventId: event.id,
        sessionId,
        status: "waiting",
        lineStatus: "registered",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [eventRegistrations.eventId, eventRegistrations.sessionId],
        set: {
          status: "waiting",
          lineStatus: "registered",
          updatedAt: now,
        },
      });

    const count = await getWaitingCount(db, event.id);
    const response = NextResponse.json({
      eventKey,
      count,
      registered: true,
      updatedAt: now.toISOString(),
    });

    if (shouldSetCookie) setSessionCookie(response, sessionId);
    return response;
  } catch {
    return NextResponse.json({ error: "REGISTRATION_UNAVAILABLE" }, { status: 503 });
  }
}
