import { and, count, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { eventRegistrations, events } from "../db/schema";

type Database = ReturnType<typeof getDb>;

export const NEXT_EVENT_KEY = "next-saturday";
export const INITIAL_EVENT_CAPACITY = 100;

export type RegistrationReservation = {
  registered: boolean;
  waitingCount: number;
  capacity: number;
};

function nextSaturdayAtNoonJst() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilSaturday = (6 - today.getUTCDay() + 7) % 7 || 7;
  today.setUTCDate(today.getUTCDate() + daysUntilSaturday);
  today.setUTCHours(3, 0, 0, 0);
  return today;
}

export async function ensureEvent(db: Database, eventKey: string) {
  const existing = await db.query.events.findFirst({ where: eq(events.eventKey, eventKey) });
  if (existing) return existing;

  await db
    .insert(events)
    .values({
      eventKey,
      startsAt: nextSaturdayAtNoonJst(),
      status: "open",
      capacity: INITIAL_EVENT_CAPACITY,
      waitingCount: 0,
    })
    .onConflictDoNothing({ target: events.eventKey });

  const created = await db.query.events.findFirst({ where: eq(events.eventKey, eventKey) });
  if (!created) throw new Error("Event could not be created.");
  return created;
}

export async function reserveEventRegistration(
  db: Database,
  eventId: string,
  sessionId: string,
): Promise<RegistrationReservation> {
  const rows = await db.execute(sql`
    SELECT registered, waiting_count AS "waitingCount", capacity
    FROM register_event_waiting(${eventId}::uuid, ${sessionId}::uuid)
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
): Promise<RegistrationReservation> {
  const existing = await db.query.eventRegistrations.findFirst({
    where: and(
      eq(eventRegistrations.eventId, eventId),
      eq(eventRegistrations.sessionId, sessionId),
    ),
  });

  if (!existing || existing.lineStatus !== "registered") {
    await db
      .insert(eventRegistrations)
      .values({
        eventId,
        sessionId,
        status: "waiting",
        lineStatus: "not_registered",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [eventRegistrations.eventId, eventRegistrations.sessionId],
        set: {
          status: "waiting",
          lineStatus: "not_registered",
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
