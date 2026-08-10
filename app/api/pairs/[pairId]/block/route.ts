import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { blocks, eventPairs } from "../../../../../db/schema";
import { getApiAuthUser } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pairId: string }> },
) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { pairId } = await params;
  try {
    const db = getDb();
    const [pair] = await db.select().from(eventPairs).where(eq(eventPairs.id, pairId)).limit(1);
    if (!pair || (pair.participantAId !== user.id && pair.participantBId !== user.id)) {
      return NextResponse.json({ error: "PAIR_NOT_FOUND" }, { status: 404 });
    }
    const blockedUserId = pair.participantAId === user.id ? pair.participantBId : pair.participantAId;
    await db.insert(blocks).values({ pairId, blockerUserId: user.id, blockedUserId }).onConflictDoNothing();
    await db.update(eventPairs).set({ status: "blocked", updatedAt: new Date() }).where(eq(eventPairs.id, pairId));
    return NextResponse.json({ blocked: true });
  } catch {
    return NextResponse.json({ error: "BLOCK_UNAVAILABLE" }, { status: 503 });
  }
}
