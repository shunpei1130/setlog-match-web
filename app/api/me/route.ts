import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { clearAuthCookie, getApiAuthUser, getCurrentAuthUser } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      lineLinked: Boolean(user.lineUserId),
      lineFollowed: user.lineFollowed,
      instagramHandle: Boolean(user.instagramHandle),
      lineContact: Boolean(user.lineContact),
    },
  });
}

export async function DELETE(request: Request) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const db = getDb();
    await db.execute(sql`
      WITH deleted_registrations AS (
        DELETE FROM event_registrations
        WHERE user_id = ${user.id}::uuid
        RETURNING event_id, status, line_status
      ), adjusted_events AS (
        UPDATE events AS e
        SET waiting_count = GREATEST(
          0,
          e.waiting_count - counts.removed_count
        )
        FROM (
          SELECT event_id, count(*)::integer AS removed_count
          FROM deleted_registrations
          WHERE status = 'waiting' AND line_status = 'registered'
          GROUP BY event_id
        ) AS counts
        WHERE e.id = counts.event_id
        RETURNING e.id
      ), deleted_codes AS (
        DELETE FROM authentication_codes
        WHERE email = ${user.email}
      )
      DELETE FROM users WHERE id = ${user.id}::uuid
    `);
    const response = NextResponse.json({ deleted: true });
    clearAuthCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: "ACCOUNT_DELETE_UNAVAILABLE" }, { status: 503 });
  }
}
