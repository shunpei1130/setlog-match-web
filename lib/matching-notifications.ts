import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { lineMatchingDeliveries } from "../db/schema";
import { isAllowedAuthEmail } from "./auth-email";
import { pushLineMessages } from "./line";
import { buildLiffUrl } from "./liff";
import { matchingResultMessages } from "./matching-message";

// Sends the Saturday matching result to every eligible participant of a weekly
// event whose matching run has completed: pair members get the "matched"
// message, everyone else gets the "unmatched" message. Each (event, user) pair
// is claimed in line_matching_deliveries before sending, mirroring the Friday
// line-reminder, so reruns never send twice. A failed push releases the claim
// (so a later run can retry that user) without blocking the other recipients.
export async function sendMatchingResultNotifications(eventId: string) {
  if (process.env.APP_ENV === "review") return { sent: 0, attempted: 0, failed: 0 };
  const db = getDb();
  const { rows } = await db.execute<{ userId: string; lineUserId: string; email: string; matched: boolean }>(sql`
    SELECT r.user_id AS "userId", u.line_user_id AS "lineUserId", u.email AS "email",
      EXISTS (
        SELECT 1 FROM event_pairs p
        WHERE p.event_id = e.id AND p.status = 'published'
          AND (p.participant_a_id = r.user_id OR p.participant_b_id = r.user_id)
      ) AS "matched"
    FROM events e
    JOIN matching_runs m ON m.event_id = e.id
    JOIN event_registrations r ON r.event_id = e.id
    JOIN users u ON u.id = r.user_id
    LEFT JOIN line_matching_deliveries d ON d.event_id = e.id AND d.user_id = r.user_id
    WHERE e.id = ${eventId}::uuid
      AND e.kind = 'weekly'
      AND e.starts_at <= now()
      AND e.starts_at + interval '11 hours' > now()
      AND r.status = 'waiting'
      AND r.line_status = 'registered'
      AND r.age_confirmed_at IS NOT NULL
      AND r.rules_accepted_at IS NOT NULL
      AND r.nickname IS NOT NULL
      AND r.faculty IS NOT NULL
      AND r.academic_year IS NOT NULL
      AND r.gender IN ('male', 'female', 'other')
      AND u.email_verified_at IS NOT NULL
      AND u.line_followed
      AND u.line_user_id IS NOT NULL
      AND d.id IS NULL
  `);
  const recipients = rows.filter((row) => isAllowedAuthEmail(row.email));
  const liffUrl = buildLiffUrl();
  let sent = 0;
  let failed = 0;
  for (const row of recipients) {
    const [claim] = await db.insert(lineMatchingDeliveries)
      .values({ eventId, userId: row.userId })
      .onConflictDoNothing()
      .returning({ id: lineMatchingDeliveries.id });
    if (!claim) continue;
    try {
      await pushLineMessages(row.lineUserId, matchingResultMessages(row.matched, liffUrl));
      sent += 1;
    } catch {
      failed += 1;
      await db.delete(lineMatchingDeliveries).where(eq(lineMatchingDeliveries.id, claim.id));
    }
  }
  return { sent, attempted: recipients.length, failed };
}
