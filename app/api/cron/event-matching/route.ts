import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { automaticMatchingEnabled, ensureAutomaticMatching } from "../../../../lib/lifecycle";
import { sendMatchingResultNotifications } from "../../../../lib/matching-notifications";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  if (!automaticMatchingEnabled()) return NextResponse.json({ enabled: false, processed: 0 });
  try {
    const { rows } = await getDb().execute<{ id: string }>(sql`SELECT e.id FROM events e LEFT JOIN matching_runs m ON m.event_id=e.id
      WHERE e.kind='weekly' AND e.status='open' AND e.starts_at<=now() AND e.starts_at+interval '11 hours'>now() AND m.event_id IS NULL`);
    for (const row of rows) await ensureAutomaticMatching(row.id);
    // Notify every participant of each in-window weekly event whose matching
    // has completed, including events finalized early via the participation
    // API. Deliveries are claimed per (event, user), so this never resends.
    const { rows: notifiable } = await getDb().execute<{ id: string }>(sql`SELECT e.id FROM events e
      JOIN matching_runs m ON m.event_id=e.id
      WHERE e.kind='weekly' AND e.status='open' AND e.starts_at<=now() AND e.starts_at+interval '11 hours'>now()`);
    let notified = 0;
    for (const row of notifiable) {
      const result = await sendMatchingResultNotifications(row.id);
      notified += result.sent;
    }
    return NextResponse.json({ enabled: true, processed: rows.length, notified });
  } catch { return NextResponse.json({ error: "MATCHING_UNAVAILABLE" }, { status: 503 }); }
}
