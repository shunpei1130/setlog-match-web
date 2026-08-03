import { and, count, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { eventRegistrations, events } from "../db/schema";

type Database = ReturnType<typeof getDb>;

export const NEXT_EVENT_KEY = "next-saturday";

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
    .values({ eventKey, startsAt: nextSaturdayAtNoonJst(), status: "open" })
    .onConflictDoNothing({ target: events.eventKey });

  const created = await db.query.events.findFirst({ where: eq(events.eventKey, eventKey) });
  if (!created) throw new Error("Event could not be created.");
  return created;
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
