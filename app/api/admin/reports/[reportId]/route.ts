import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { safetyReports } from "../../../../../db/schema";
import { getCurrentAuthUser, isAdminEmail } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const admin = await getCurrentAuthUser();
  if (!admin || !isAdminEmail(admin.email)) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const body = await request.json().catch(() => null) as { status?: unknown; adminNote?: unknown } | null;
  const status = body?.status;
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) || null : null;
  if (status !== "open" && status !== "reviewed" && status !== "resolved") {
    return NextResponse.json({ error: "REPORT_STATUS_INVALID" }, { status: 400 });
  }
  const { reportId } = await params;
  try {
    const now = new Date();
    const [report] = await getDb().update(safetyReports).set({
      status,
      adminNote,
      reviewedAt: status === "open" ? null : now,
      resolvedAt: status === "resolved" ? now : null,
      updatedAt: now,
    }).where(eq(safetyReports.id, reportId)).returning();
    if (!report) return NextResponse.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "REPORT_UPDATE_UNAVAILABLE" }, { status: 503 });
  }
}
