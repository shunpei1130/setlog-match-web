import { NextResponse } from "next/server";
import { getApiAuthUser } from "../../../../../lib/auth";
import { LifecycleError, stopPair } from "../../../../../lib/lifecycle";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pairId: string }> },
) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { reason?: unknown; detail?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 1000) : null;
  if (!reason || reason.length > 120) return NextResponse.json({ error: "REPORT_REASON_REQUIRED" }, { status: 400 });
  const { pairId } = await params;
  try {
    await stopPair(pairId, user.id, { reason, detail });
    return NextResponse.json({ reported: true });
  } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "REPORT_UNAVAILABLE" }, { status: 503 });
  }
}
