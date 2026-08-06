import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { safetyReports } from "../../../../db/schema";
import { getCurrentAuthUser, isAdminEmail } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAuthUser();
  if (!admin || !isAdminEmail(admin.email)) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  try {
    const reports = await getDb().select().from(safetyReports).orderBy(desc(safetyReports.createdAt));
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "REPORTS_UNAVAILABLE" }, { status: 503 });
  }
}
