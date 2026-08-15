import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../../db";
import { getCurrentAuthUser, isAdminEmail } from "../../../../../../lib/auth";
import { ensureEvent } from "../../../../../../lib/event-registration";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentAuthUser();
  return user && isAdminEmail(user.email) ? user : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const { eventKey } = await params;
  try {
    const db = getDb();
    const event = await ensureEvent(db, eventKey);
    const rows = await db.execute(sql`
      SELECT
        r.user_id AS "userId",
        u.email,
        r.nickname,
        r.faculty,
        r.academic_year AS "academicYear",
        r.gender,
        r.purpose,
        r.preferred_gender AS "preferredGender",
        r.status,
        r.line_status AS "lineStatus",
        u.line_followed AS "lineFollowed",
        u.instagram_handle AS "instagramHandle",
        u.line_contact AS "lineContact",
        r.created_at AS "createdAt"
      FROM event_registrations r
      JOIN events e ON e.id = r.event_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE e.event_key = ${event.eventKey}
      ORDER BY r.created_at ASC
    `);
    return NextResponse.json({ eventKey: event.eventKey, participants: rows });
  } catch {
    return NextResponse.json({ error: "ADMIN_DATA_UNAVAILABLE" }, { status: 503 });
  }
}
