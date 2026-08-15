import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { getCurrentAuthUser, isAdminEmail } from "../../../../lib/auth";

export const runtime = "nodejs";

const metricNames = ["qualifiedVisits", "authCodeRequests", "emailVerified", "lineLinked", "lineFollowed", "registrationsCompleted", "activatedInEvent", "decisionsSubmitted"] as const;

export async function GET() {
  const admin = await getCurrentAuthUser();
  if (!admin || !isAdminEmail(admin.email)) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  try {
    const rows = await getDb().execute(sql`
      SELECT
        COALESCE(ref_code, 'direct') AS "refCode",
        COALESCE(utm_source, '') AS "utmSource",
        COALESCE(utm_campaign, '') AS "utmCampaign",
        count(DISTINCT visitor_id) FILTER (WHERE event_name = 'qualified_visit') AS "qualifiedVisits",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'auth_code_requested') AS "authCodeRequests",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'email_verified') AS "emailVerified",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'line_linked') AS "lineLinked",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'line_followed') AS "lineFollowed",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'registration_completed') AS "registrationsCompleted",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'event_activated') AS "activatedInEvent",
        count(DISTINCT COALESCE(user_id::text, visitor_id::text)) FILTER (WHERE event_name = 'decision_submitted') AS "decisionsSubmitted"
      FROM funnel_events
      WHERE created_at >= now() - interval '90 days'
      GROUP BY COALESCE(ref_code, 'direct'), COALESCE(utm_source, ''), COALESCE(utm_campaign, '')
      ORDER BY "registrationsCompleted" DESC, "qualifiedVisits" DESC
    `) as unknown as Array<Record<string, string | number>>;
    const sources = rows.map((row) => ({
      ...row,
      ...Object.fromEntries(metricNames.map((name) => [name, Number(row[name] ?? 0)])),
    }));
    const totals = Object.fromEntries(metricNames.map((name) => [
      name,
      sources.reduce((sum, row) => sum + Number(row[name] ?? 0), 0),
    ]));
    return NextResponse.json({ windowDays: 90, totals, sources });
  } catch {
    return NextResponse.json({ error: "METRICS_UNAVAILABLE" }, { status: 503 });
  }
}
