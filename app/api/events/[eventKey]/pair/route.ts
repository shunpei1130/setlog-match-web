import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { getCurrentAuthUser } from "../../../../../lib/auth";
import { getPublishedPairForUser } from "../../../../../lib/pair";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { eventKey } = await params;
  try {
    const pair = await getPublishedPairForUser(getDb(), eventKey, user.id);
    if (!pair) return NextResponse.json({ error: "PAIR_NOT_PUBLISHED" }, { status: 404 });
    return NextResponse.json({ pair });
  } catch {
    return NextResponse.json({ error: "PAIR_UNAVAILABLE" }, { status: 503 });
  }
}
