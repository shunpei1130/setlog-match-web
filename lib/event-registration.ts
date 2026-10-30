import { and, count, eq } from "drizzle-orm";
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
  if (eventKey.startsWith("sun-")) throw new Error("EVENT_NOT_FOUND");
  if (eventKey !== NEXT_EVENT_ALIAS && schedule.eventKey !== currentWeeklyEventSchedule(now).eventKey
    && schedule.eventKey !== currentWeeklyEventSchedule(new Date(now.getTime() + 7 * 86400_000)).eventKey) {
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
    kind: event.kind as "weekly" | "extension",
    ...timing,
    registrationOpen: event.kind !== "extension" && event.status === "open" && timing.registrationOpen,
    canCancel: event.status === "open" && timing.canCancel,
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
