import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { lineReminderDeliveries } from "../../../../db/schema";
import { pushLineMessage } from "../../../../lib/line";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT e.id AS "eventId", r.user_id AS "userId", u.line_user_id AS "lineUserId"
      FROM events e
      JOIN event_registrations r ON r.event_id = e.id
      JOIN users u ON u.id = r.user_id
      LEFT JOIN line_reminder_deliveries d ON d.event_id = e.id AND d.user_id = r.user_id
      WHERE e.event_key = 'next-saturday'
        AND r.status = 'waiting'
        AND r.line_status = 'registered'
        AND u.line_followed = true
        AND u.line_user_id IS NOT NULL
        AND d.id IS NULL
    `) as unknown as Array<{ eventId: string; userId: string; lineUserId: string }>;
    let sent = 0;
    for (const row of rows) {
      const [claim] = await db.insert(lineReminderDeliveries)
        .values({ eventId: row.eventId, userId: row.userId })
        .onConflictDoNothing()
        .returning({ id: lineReminderDeliveries.id });
      if (!claim) continue;

      try {
        await pushLineMessage(row.lineUserId, "明日はマッチング！\n参加アンケートを確認して、土曜の一日を始める準備をしてください。\n\nSetlog Match");
        sent += 1;
      } catch (error) {
        await db.delete(lineReminderDeliveries).where(eq(lineReminderDeliveries.id, claim.id));
        throw error;
      }
    }
    return NextResponse.json({ sent, attempted: rows.length });
  } catch {
    return NextResponse.json({ error: "LINE_REMINDER_UNAVAILABLE" }, { status: 503 });
  }
}
