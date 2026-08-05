import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { ensureEvent, recordLocalTestRegistration, reserveEventRegistration } from "../../../../../lib/event-registration";
import { isLocalTestHostname } from "../../../../../lib/local-test";
import { getOrCreateSessionId, setSessionCookie } from "../../../../../lib/session";
import { normalizeAoyamaEmail } from "../../../../../lib/school-email";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;
  const body = await request.json().catch(() => null) as {
    lineRegistered?: boolean;
    lineTestBypass?: boolean;
    schoolEmailTestBypass?: boolean;
    schoolEmail?: unknown;
  } | null;
  const isLocalTestRequest = isLocalTestHostname(new URL(request.url).hostname);
  const requestedLocalBypass = body?.lineTestBypass === true || body?.schoolEmailTestBypass === true;
  const localTestBypass = isLocalTestRequest
    && body?.lineTestBypass === true
    && body?.schoolEmailTestBypass === true;

  if (requestedLocalBypass && !isLocalTestRequest) {
    return NextResponse.json({ error: "LOCAL_TEST_BYPASS_NOT_ALLOWED" }, { status: 400 });
  }

  if (body?.lineRegistered !== true && !localTestBypass) {
    return NextResponse.json({ error: "LINE_REGISTRATION_REQUIRED" }, { status: 400 });
  }

  if (!localTestBypass && !normalizeAoyamaEmail(body?.schoolEmail)) {
    return NextResponse.json({ error: "AOYAMA_EMAIL_REQUIRED" }, { status: 400 });
  }

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const { sessionId, shouldSetCookie } = await getOrCreateSessionId();
    const reservation = localTestBypass
      ? await recordLocalTestRegistration(db, event.id, sessionId)
      : await reserveEventRegistration(db, event.id, sessionId);
    const now = new Date();
    const response = NextResponse.json({
      eventKey,
      count: reservation.waitingCount,
      capacity: reservation.capacity,
      remaining: Math.max(0, reservation.capacity - reservation.waitingCount),
      registered: reservation.registered,
      updatedAt: now.toISOString(),
    }, { status: reservation.registered ? 200 : 409 });

    if (!reservation.registered) {
      return NextResponse.json({
        error: "EVENT_FULL",
        count: reservation.waitingCount,
        capacity: reservation.capacity,
        remaining: 0,
      }, { status: 409 });
    }

    if (shouldSetCookie) setSessionCookie(response, sessionId);
    return response;
  } catch {
    return NextResponse.json({ error: "REGISTRATION_UNAVAILABLE" }, { status: 503 });
  }
}
