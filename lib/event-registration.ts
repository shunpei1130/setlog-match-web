import { and, count, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { eventRegistrations, events } from "../db/schema";
import { currentWeeklyEventSchedule, NEXT_EVENT_ALIAS, scheduleForEventKey, timingForEvent } from "./event-schedule";
import type { RegistrationPreferences, RegistrationProfile } from "./profile";

type Database = ReturnType<typeof getDb>;

export const NEXT_EVENT_KEY = NEXT_EVENT_ALIAS;
export const INITIAL_EVENT_CAPACITY = 100;

export type RegistrationReservation = {
  registered: boolean;
  waitingCount: number;
  capacity: number;
};

export async function ensureEvent(db: Database, eventKey: string, now = new Date()) {
  const schedule = scheduleForEventKey(eventKey, now);
  const existing = await db.query.events.findFirst({ where: eq(events.eventKey, schedule.eventKey) });
  if (existing) return existing;
  if (eventKey !== NEXT_EVENT_ALIAS && schedule.eventKey !== currentWeeklyEventSchedule(now).eventKey) {
    throw new Error("EVENT_NOT_FOUND");
  }

  await db
    .insert(events)
    .values({
      eventKey: schedule.eventKey,
      startsAt: schedule.startsAt,
      status: "open",
      capacity: INITIAL_EVENT_CAPACITY,
      waitingCount: 0,
    })
    .onConflictDoNothing({ target: events.eventKey });

  const created = await db.query.events.findFirst({ where: eq(events.eventKey, schedule.eventKey) });
  if (!created) throw new Error("Event could not be created.");
  return created;
}

export function eventState(event: typeof events.$inferSelect, now = new Date()) {
  const timing = timingForEvent(event.startsAt, now);
  return {
    eventKey: event.eventKey,
    ...timing,
    registrationOpen: event.status === "open" && timing.registrationOpen,
    canCancel: event.status === "open" && timing.canCancel,
  };
}

export async function cancelEventRegistration(db: Database, eventId: string, userId: string) {
  const rows = await db.execute(sql`
    WITH cancelled AS (
      UPDATE event_registrations
      SET status = 'cancelled', updated_at = now()
      WHERE event_id = ${eventId}::uuid
        AND user_id = ${userId}::uuid
        AND status = 'waiting'
      RETURNING line_status
    ), removed_pairs AS (
      DELETE FROM event_pairs
      WHERE event_id = ${eventId}::uuid
        AND (${userId}::uuid = participant_a_id OR ${userId}::uuid = participant_b_id)
        AND EXISTS (SELECT 1 FROM cancelled)
      RETURNING id
    ), adjusted AS (
      UPDATE events
      SET waiting_count = GREATEST(
        0,
        waiting_count - (
          SELECT count(*)::integer
          FROM cancelled
          WHERE line_status = 'registered'
        )
      )
      WHERE id = ${eventId}::uuid
      RETURNING id
    )
    SELECT
      EXISTS(SELECT 1 FROM cancelled) AS cancelled,
      (SELECT count(*)::integer FROM removed_pairs) AS "removedPairs"
  `);
  const [result] = rows as unknown as Array<{ cancelled: boolean; removedPairs: number }>;
  return Boolean(result?.cancelled);
}

export async function reserveEventRegistration(
  db: Database,
  eventId: string,
  sessionId: string,
  userId: string,
  profile: RegistrationProfile,
  preferences: RegistrationPreferences,
): Promise<RegistrationReservation> {
  const rows = await db.execute(sql`
    SELECT registered, waiting_count AS "waitingCount", capacity
    FROM register_event_waiting(
      ${eventId}::uuid,
      ${sessionId}::uuid,
      ${userId}::uuid,
      ${profile.nickname},
      ${profile.faculty},
      ${profile.academicYear},
      ${profile.gender},
      ${preferences.purpose}::match_purpose,
      ${preferences.preferredGender}::gender_preference
    )
  `);
  const [result] = rows as unknown as Array<{
    registered: boolean;
    waitingCount: number | string;
    capacity: number | string;
  }>;

  if (!result) throw new Error("Registration reservation was not returned.");

  return {
    registered: result.registered,
    waitingCount: Number(result.waitingCount),
    capacity: Number(result.capacity),
  };
}

export async function recordLocalTestRegistration(
  db: Database,
  eventId: string,
  sessionId: string,
  userId: string | null,
  profile: RegistrationProfile,
  preferences: RegistrationPreferences,
): Promise<RegistrationReservation> {
  const existing = await db.query.eventRegistrations.findFirst({
    where: and(
      eq(eventRegistrations.eventId, eventId),
      eq(eventRegistrations.sessionId, sessionId),
    ),
  });

  if (existing?.lineStatus === "registered") {
    await db
      .update(eventRegistrations)
      .set({
        userId,
        nickname: profile.nickname,
        faculty: profile.faculty,
        academicYear: profile.academicYear,
        gender: profile.gender,
        purpose: preferences.purpose,
        preferredGender: preferences.preferredGender,
        updatedAt: new Date(),
      })
      .where(eq(eventRegistrations.id, existing.id));
  } else {
    await db
      .insert(eventRegistrations)
      .values({
        eventId,
        userId,
        sessionId,
        status: "waiting",
        lineStatus: "not_registered",
        nickname: profile.nickname,
        faculty: profile.faculty,
        academicYear: profile.academicYear,
        gender: profile.gender,
        purpose: preferences.purpose,
        preferredGender: preferences.preferredGender,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [eventRegistrations.eventId, eventRegistrations.sessionId],
        set: {
          status: "waiting",
          lineStatus: "not_registered",
          userId,
          nickname: profile.nickname,
          faculty: profile.faculty,
          academicYear: profile.academicYear,
          gender: profile.gender,
          purpose: preferences.purpose,
          preferredGender: preferences.preferredGender,
          updatedAt: new Date(),
        },
      });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw new Error("Event could not be found.");

  return {
    registered: true,
    waitingCount: event.waitingCount,
    capacity: event.capacity,
  };
}

export async function getWaitingCount(db: Database, eventId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.status, "waiting"),
        eq(eventRegistrations.lineStatus, "registered"),
      ),
    );

  return Number(result?.count ?? 0);
}
