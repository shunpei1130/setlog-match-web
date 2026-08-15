import { and, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../../db";
import { eventPairs, eventRegistrations } from "../../../../../../db/schema";
import { getCurrentAuthUser, isAdminEmail } from "../../../../../../lib/auth";
import { ensureEvent } from "../../../../../../lib/event-registration";
import { arePairPreferencesCompatible, type GenderPreference, type MatchPurpose, type ProfileGender } from "../../../../../../lib/profile";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentAuthUser();
  return user && isAdminEmail(user.email) ? user : null;
}

function normalizeSetlogUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSetlogCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code.length > 0 && code.length <= 120 ? code : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const { eventKey } = await params;
  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.status,
        p.setlog_url AS "setlogUrl",
        p.setlog_code AS "setlogCode",
        p.participant_a_id AS "participantAId",
        ua.email AS "participantAEmail",
        p.participant_b_id AS "participantBId",
        ub.email AS "participantBEmail"
      FROM event_pairs p
      JOIN events e ON e.id = p.event_id
      JOIN users ua ON ua.id = p.participant_a_id
      JOIN users ub ON ub.id = p.participant_b_id
      WHERE e.event_key = ${event.eventKey}
      ORDER BY p.created_at ASC
    `);
    return NextResponse.json({ eventKey: event.eventKey, pairs: rows });
  } catch {
    return NextResponse.json({ error: "ADMIN_DATA_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const { eventKey } = await params;
  const body = await request.json().catch(() => null) as {
    participantAId?: unknown;
    participantBId?: unknown;
    setlogUrl?: unknown;
    setlogCode?: unknown;
  } | null;
  const participantAId = typeof body?.participantAId === "string" ? body.participantAId : "";
  const participantBId = typeof body?.participantBId === "string" ? body.participantBId : "";
  const setlogUrl = normalizeSetlogUrl(body?.setlogUrl);
  const setlogCode = normalizeSetlogCode(body?.setlogCode);
  if (body?.setlogUrl && !setlogUrl) return NextResponse.json({ error: "SETLOG_URL_INVALID" }, { status: 400 });
  if (body?.setlogCode && !setlogCode) return NextResponse.json({ error: "SETLOG_CODE_INVALID" }, { status: 400 });
  if (!participantAId || !participantBId || participantAId === participantBId) {
    return NextResponse.json({ error: "PAIR_PARTICIPANTS_INVALID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const registrations = await db.select({
      userId: eventRegistrations.userId,
      gender: eventRegistrations.gender,
      purpose: eventRegistrations.purpose,
      preferredGender: eventRegistrations.preferredGender,
    })
      .from(eventRegistrations)
      .where(and(
        eq(eventRegistrations.eventId, event.id),
        eq(eventRegistrations.status, "waiting"),
        eq(eventRegistrations.lineStatus, "registered"),
      ));
    const registeredIds = new Set(registrations.map((registration) => registration.userId).filter(Boolean));
    if (!registeredIds.has(participantAId) || !registeredIds.has(participantBId)) {
      return NextResponse.json({ error: "PAIR_PARTICIPANT_NOT_REGISTERED" }, { status: 400 });
    }
    const participantA = registrations.find((registration) => registration.userId === participantAId);
    const participantB = registrations.find((registration) => registration.userId === participantBId);
    if (!participantA?.gender || !participantB?.gender) {
      return NextResponse.json({ error: "PAIR_PARTICIPANT_PROFILE_INCOMPLETE" }, { status: 400 });
    }
    const compatible = arePairPreferencesCompatible(
      { gender: participantA.gender as ProfileGender, purpose: participantA.purpose as MatchPurpose, preferredGender: participantA.preferredGender as GenderPreference },
      { gender: participantB.gender as ProfileGender, purpose: participantB.purpose as MatchPurpose, preferredGender: participantB.preferredGender as GenderPreference },
    );
    if (!compatible) {
      return NextResponse.json({ error: "PAIR_PREFERENCES_MISMATCH" }, { status: 409 });
    }
    const occupied = await db.select({ id: eventPairs.id }).from(eventPairs).where(and(
      eq(eventPairs.eventId, event.id),
      or(eq(eventPairs.status, "draft"), eq(eventPairs.status, "published")),
      or(
        eq(eventPairs.participantAId, participantAId),
        eq(eventPairs.participantBId, participantAId),
        eq(eventPairs.participantAId, participantBId),
        eq(eventPairs.participantBId, participantBId),
      ),
    )).limit(1);
    if (occupied.length > 0) return NextResponse.json({ error: "PAIR_PARTICIPANT_ALREADY_PAIRED" }, { status: 409 });
    const [pair] = await db.insert(eventPairs).values({
      eventId: event.id,
      participantAId,
      participantBId,
      setlogUrl,
      setlogCode,
    }).returning();
    return NextResponse.json({ pair }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "PAIR_CREATE_UNAVAILABLE" }, { status: 503 });
  }
}
