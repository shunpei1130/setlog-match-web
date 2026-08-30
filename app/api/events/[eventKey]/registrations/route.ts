import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { eventRegistrations, users } from "../../../../../db/schema";
import { getApiAuthUser } from "../../../../../lib/auth";
import { isAllowedAuthEmail } from "../../../../../lib/auth-email";
import { cancelEventRegistration, ensureEvent, eventState, getWaitingCount, recordLocalTestRegistration, reserveEventRegistration } from "../../../../../lib/event-registration";
import { isLocalTestHostname } from "../../../../../lib/local-test";
import { validateContactHandles, validateRegistrationPreferences, validateRegistrationProfile } from "../../../../../lib/profile";
import { getOrCreateSessionId, setSessionCookie } from "../../../../../lib/session";
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
    const [registration, count] = await Promise.all([
      db.query.eventRegistrations.findFirst({
        where: (row, operators) => and(
          operators.eq(row.eventId, event.id),
          operators.eq(row.userId, user.id),
        ),
      }),
      getWaitingCount(db, event.id),
    ]);
    return NextResponse.json({
      ...eventState(event),
      registration: registration ? {
        status: registration.status,
        lineStatus: registration.lineStatus,
        nickname: registration.nickname,
        faculty: registration.faculty,
        academicYear: registration.academicYear,
        gender: registration.gender,
        purpose: registration.purpose,
        preferredGender: registration.preferredGender,
        ageConfirmed: Boolean(registration.ageConfirmedAt),
        rulesAccepted: Boolean(registration.rulesAcceptedAt),
      } : null,
      count,
      capacity: event.capacity,
      remaining: Math.max(0, event.capacity - count),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "REGISTRATION_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;
  const body = await request.json().catch(() => null) as {
    profile?: unknown;
    preferences?: unknown;
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
  const localTestBypass = process.env.NODE_ENV !== "production"
    && isLocalTestRequest
    && body?.lineTestBypass === true
    && body?.schoolEmailTestBypass === true;

  if (requestedLocalBypass && !isLocalTestRequest) {
    return NextResponse.json({ error: "LOCAL_TEST_BYPASS_NOT_ALLOWED" }, { status: 400 });
  }

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
  const preferenceValidation = validateRegistrationPreferences(body?.preferences);
  if (preferenceValidation.missing.length > 0) {
    return NextResponse.json({ error: "PREFERENCES_REQUIRED", fields: preferenceValidation.missing }, { status: 400 });
  }
  if (preferenceValidation.invalid.length > 0 || !preferenceValidation.preferences) {
    return NextResponse.json({ error: "PREFERENCES_INVALID", fields: preferenceValidation.invalid }, { status: 400 });
  }

  if (!localTestBypass && body?.ageConfirmed !== true) {
    return NextResponse.json({ error: "AGE_CONFIRMATION_REQUIRED" }, { status: 400 });
  }
  if (!localTestBypass && body?.rulesAccepted !== true) {
    return NextResponse.json({ error: "RULES_ACCEPTANCE_REQUIRED" }, { status: 400 });
  }

  const currentUser = localTestBypass ? null : await getApiAuthUser(request);
  if (!localTestBypass && !currentUser) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!localTestBypass && (!currentUser?.lineUserId || !currentUser.lineFollowed)) {
    return NextResponse.json({ error: "LINE_REGISTRATION_REQUIRED" }, { status: 400 });
  }

  if (!localTestBypass && (!currentUser?.email || !isAllowedAuthEmail(currentUser.email))) {
    return NextResponse.json({ error: "AOYAMA_EMAIL_REQUIRED" }, { status: 400 });
  }

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const timing = eventState(event);
    if (!timing.registrationOpen) {
      return NextResponse.json({ error: "EVENT_REGISTRATION_CLOSED", ...timing }, { status: 409 });
    }
    const session = currentUser
      ? { sessionId: currentUser.sessionId, shouldSetCookie: false }
      : await getOrCreateSessionId();
    const { sessionId, shouldSetCookie } = session;
    const userId = currentUser?.id ?? null;
    if (currentUser) {
      await db.update(users).set({
        instagramHandle: contactValidation.contacts.instagramHandle,
        lineContact: contactValidation.contacts.lineContact,
        updatedAt: new Date(),
      }).where(eq(users.id, currentUser.id));
    }
    const reservation = localTestBypass
      ? await recordLocalTestRegistration(db, event.id, sessionId, userId, profileValidation.profile, preferenceValidation.preferences)
      : await reserveEventRegistration(db, event.id, sessionId, currentUser!.id, profileValidation.profile, preferenceValidation.preferences);
    if (currentUser) {
      const registration = await db.query.eventRegistrations.findFirst({
        where: (eventRegistration, operators) => and(
          operators.eq(eventRegistration.eventId, event.id),
          operators.eq(eventRegistration.userId, currentUser.id),
        ),
      });
      if (registration) await db.update(eventRegistrations).set({
        userId: currentUser.id,
        lineStatus: "registered",
        ageConfirmedAt: new Date(),
        rulesAcceptedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(eventRegistrations.id, registration.id));
    }
    const now = new Date();
    const response = NextResponse.json({
      ...timing,
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

    await recordFunnelEvent(db, request, "registration_completed", {
      userId,
      eventId: event.id,
      visitorId: readVisitorId(request) ?? userId ?? sessionId,
      dedupeKey: `registration_completed:${event.id}:${userId ?? sessionId}`,
    });

    if (shouldSetCookie) setSessionCookie(response, sessionId);
    return response;
  } catch {
    return NextResponse.json({ error: "REGISTRATION_UNAVAILABLE" }, { status: 503 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { eventKey } = await params;

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const timing = eventState(event);
    if (!timing.canCancel) {
      return NextResponse.json({ error: "REGISTRATION_CANCELLATION_CLOSED", ...timing }, { status: 409 });
    }
    const cancelled = await cancelEventRegistration(db, event.id, user.id);
    const count = await getWaitingCount(db, event.id);
    return NextResponse.json({
      ...timing,
      cancelled,
      count,
      capacity: event.capacity,
      remaining: Math.max(0, event.capacity - count),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "REGISTRATION_UNAVAILABLE" }, { status: 503 });
  }
}
