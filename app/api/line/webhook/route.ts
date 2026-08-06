import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { verifyLineWebhookSignature } from "../../../../lib/line";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    if (!verifyLineWebhookSignature(body, request.headers.get("x-line-signature"))) {
      return new Response("Invalid signature", { status: 401 });
    }
    const payload = JSON.parse(body) as {
      events?: Array<{ type?: string; source?: { userId?: string } }>;
    };
    const db = getDb();
    for (const event of payload.events ?? []) {
      const lineUserId = event.source?.userId;
      if (!lineUserId) continue;
      if (event.type === "follow") {
        await db.update(users).set({ lineFollowed: true, updatedAt: new Date() }).where(eq(users.lineUserId, lineUserId));
      } else if (event.type === "unfollow") {
        await db.update(users).set({ lineFollowed: false, updatedAt: new Date() }).where(eq(users.lineUserId, lineUserId));
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "LINE_WEBHOOK_UNAVAILABLE" }, { status: 503 });
  }
}
