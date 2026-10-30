import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { eventRegistrations, events, matchingRuns } from "../db/schema";
import { currentWeeklyEventSchedule } from "./event-schedule";
import { ensureEvent, eventState, getWaitingCount } from "./event-registration";
import { automaticMatchingEnabled, ensureAutomaticMatching } from "./lifecycle";
import { getPublishedPairForUser } from "./pair";

export async function participationFor(userId: string, next = false) {
  const db = getDb();
  const now = new Date();
  const nextKey = currentWeeklyEventSchedule(new Date(now.getTime() + 86400_000)).eventKey;
  let event = await ensureEvent(db, next ? nextKey : "next-saturday");
  if (next && !eventState(event).registrationOpen) {
    event = await ensureEvent(db, currentWeeklyEventSchedule(new Date(now.getTime() + 7 * 86400_000)).eventKey);
  }
  if (!next) {
    const { rows: [extension] } = await db.execute<{ id: string }>(sql`SELECT e.id FROM pair_extensions x
      JOIN events e ON e.id=x.event_id JOIN event_registrations r ON r.event_id=e.id
      WHERE r.user_id=${userId}::uuid AND r.status='waiting' AND x.status='reserved'
        AND x.target_pair_id IN (SELECT pair_id FROM event_pair_members WHERE user_id=${userId}::uuid)
        AND (${process.env.APP_ENV === "review"} OR (e.starts_at AT TIME ZONE 'Asia/Tokyo')::date=(now() AT TIME ZONE 'Asia/Tokyo')::date)
      ORDER BY e.starts_at LIMIT 1`);
    if (extension) event = (await db.select().from(events).where(eq(events.id, extension.id)))[0];
    const { rows: [progress] } = await db.execute<{ registration: string | null; pairStatus: string | null; finalized: string | null; run: string | null; pairId: string | null }>(sql`
      SELECT r.status AS registration,p.status AS "pairStatus",p.finalized_at AS finalized,m.event_id AS run,p.id AS "pairId"
      FROM events e LEFT JOIN event_registrations r ON r.event_id=e.id AND r.user_id=${userId}::uuid
      LEFT JOIN event_pair_members member ON member.event_id=e.id AND member.user_id=${userId}::uuid
      LEFT JOIN event_pairs p ON p.id=member.pair_id LEFT JOIN matching_runs m ON m.event_id=e.id
      WHERE e.id=${event.id}::uuid`);
    const timing = eventState(event);
    const finished = timing.ended || progress.finalized || (progress.pairStatus && progress.pairStatus !== "published") || (progress.run && !progress.pairId);
    if (finished) {
      const { rows: [future] } = await db.execute<{ id: string }>(sql`SELECT e.id FROM events e JOIN event_registrations r ON r.event_id=e.id
        WHERE r.user_id=${userId}::uuid AND r.status='waiting' AND e.kind='weekly' AND e.starts_at>now()
        ORDER BY e.starts_at LIMIT 1`);
      if (future) event = (await db.select().from(events).where(eq(events.id, future.id)))[0];
    }
    if (event.kind === "weekly" && eventState(event).registrationOpen === false && progress.registration !== "waiting") {
      event = await ensureEvent(db, currentWeeklyEventSchedule(new Date(now.getTime() + 7 * 86400_000)).eventKey);
    }
  }
  await ensureAutomaticMatching(event.id);
  const [registration, count, pair, run] = await Promise.all([
    db.query.eventRegistrations.findFirst({ where: (r, { and, eq }) => and(eq(r.eventId, event.id), eq(r.userId, userId)) }),
    getWaitingCount(db, event.id),
    getPublishedPairForUser(db, event.eventKey, userId),
    db.select().from(matchingRuns).where(eq(matchingRuns.eventId, event.id)),
  ]);
  const timing = eventState(event);
  const previous = registration ? null : await db.query.eventRegistrations.findFirst({
    where: eq(eventRegistrations.userId, userId),
    orderBy: desc(eventRegistrations.updatedAt),
  });
  const profileFor = (value: typeof registration) => value ? {
    status: value.status, lineStatus: value.lineStatus, nickname: value.nickname,
    faculty: value.faculty, academicYear: value.academicYear, gender: value.gender,
    purpose: value.purpose, preferredGender: value.preferredGender,
    ageConfirmed: Boolean(value.ageConfirmedAt), rulesAccepted: Boolean(value.rulesAcceptedAt),
  } : null;
  const { rows: [membership] } = await db.execute<{ status: string }>(sql`SELECT p.status FROM event_pair_members m JOIN event_pairs p ON p.id=m.pair_id
    WHERE m.event_id=${event.id}::uuid AND m.user_id=${userId}::uuid`);
  const matchingStatus = pair ? "matched" : membership && membership.status !== "published" ? "ended"
    : now < event.startsAt ? "scheduled" : run.length || timing.ended ? "unmatched" : "processing";
  return {
    event: { ...timing, matchingStatus, automaticMatching: automaticMatchingEnabled(), registration: profileFor(registration),
      previousRegistration: profileFor(previous ?? undefined), count, capacity: event.capacity, remaining: Math.max(0, event.capacity-count), updatedAt: now.toISOString() },
    pair,
  };
}
