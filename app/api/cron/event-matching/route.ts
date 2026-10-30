import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { automaticMatchingEnabled, ensureAutomaticMatching } from "../../../../lib/lifecycle";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  if (!automaticMatchingEnabled()) return NextResponse.json({ enabled: false, processed: 0 });
  try {
    const { rows } = await getDb().execute<{ id: string }>(sql`SELECT e.id FROM events e LEFT JOIN matching_runs m ON m.event_id=e.id
      WHERE e.kind='weekly' AND e.status='open' AND e.starts_at<=now() AND e.starts_at+interval '11 hours'>now() AND m.event_id IS NULL`);
    for (const row of rows) await ensureAutomaticMatching(row.id);
    return NextResponse.json({ enabled: true, processed: rows.length });
  } catch { return NextResponse.json({ error: "MATCHING_UNAVAILABLE" }, { status: 503 }); }
}
