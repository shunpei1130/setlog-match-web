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
  const { pairId } = await params;
  try {
    await stopPair(pairId, user.id);
    return NextResponse.json({ blocked: true });
  } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "BLOCK_UNAVAILABLE" }, { status: 503 });
  }
}
