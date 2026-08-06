import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { eventRegistrations, users } from "../../../../../db/schema";
import { getCurrentAuthUser } from "../../../../../lib/auth";
import { ensureEvent, recordLocalTestRegistration, reserveEventRegistration } from "../../../../../lib/event-registration";
import { isLocalTestHostname } from "../../../../../lib/local-test";
import { validateContactHandles, validateRegistrationProfile } from "../../../../../lib/profile";
import { getOrCreateSessionId, setSessionCookie } from "../../../../../lib/session";
import { normalizeAoyamaEmail } from "../../../../../lib/school-email";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;
  const body = await request.json().catch(() => null) as {
    profile?: unknown;
    contacts?: unknown;
    ageConfirmed?: boolean;
    rulesAccepted?: boolean;
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

  const localTestBypass = isLocalTestRequest
    && body?.lineTestBypass === true
    && body?.schoolEmailTestBypass === true;

  const profileValidation = validateRegistrationProfile(body?.profile);
  if (profileValidation.missing.length > 0) {
    return NextResponse.json({ error: "PROFILE_REQUIRED", fields: profileValidation.missing }, { status: 400 });
  }
  if (profileValidation.invalid.length > 0 || !profileValidation.profile) {
    return NextResponse.json({ error: "PROFILE_INVALID", fields: profileValidation.invalid }, { status: 400 });
  }

  const contactValidation = validateContactHandles(body?.contacts);
  if (contactValidation.invalid.length > 0) {
    return NextResponse.json({ error: "CONTACT_INVALID", fields: contactValidation.invalid }, { status: 400 });
  }

  if (!localTestBypass && body?.ageConfirmed !== true) {
    return NextResponse.json({ error: "AGE_CONFIRMATION_REQUIRED" }, { status: 400 });
  }
  if (!localTestBypass && body?.rulesAccepted !== true) {
    return NextResponse.json({ error: "RULES_ACCEPTANCE_REQUIRED" }, { status: 400 });
  }

  const currentUser = localTestBypass ? null : await getCurrentAuthUser();
  if (!localTestBypass && !currentUser) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!localTestBypass && (!currentUser?.lineUserId || !currentUser.lineFollowed)) {
    return NextResponse.json({ error: "LINE_REGISTRATION_REQUIRED" }, { status: 400 });
  }

  if (!localTestBypass && !currentUser?.email) {
    return NextResponse.json({ error: "AOYAMA_EMAIL_REQUIRED" }, { status: 400 });
  }

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const { sessionId, shouldSetCookie } = await getOrCreateSessionId();
    const userId = currentUser?.id ?? null;
    if (currentUser) {
      await db.update(users).set({
        instagramHandle: contactValidation.contacts.instagramHandle,
        lineContact: contactValidation.contacts.lineContact,
        updatedAt: new Date(),
      }).where(eq(users.id, currentUser.id));
    }
    const reservation = localTestBypass
      ? await recordLocalTestRegistration(db, event.id, sessionId, userId, profileValidation.profile)
      : await reserveEventRegistration(db, event.id, sessionId, currentUser!.id, profileValidation.profile);
    if (currentUser) {
      await db.update(eventRegistrations).set({
        userId: currentUser.id,
        lineStatus: "registered",
        ageConfirmedAt: new Date(),
        rulesAcceptedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(eventRegistrations.id, (await db.query.eventRegistrations.findFirst({
        where: (registration, { and, eq }) => and(
          eq(registration.eventId, event.id),
          eq(registration.sessionId, sessionId),
        ),
      }))?.id ?? "00000000-0000-0000-0000-000000000000"));
    }
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
