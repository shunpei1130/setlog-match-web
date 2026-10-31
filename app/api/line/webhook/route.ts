import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { verifyLineWebhookSignature } from "../../../../lib/line";
import { recordFunnelEvent } from "../../../../lib/analytics";
import { handleLineInviteMessage, handleLineJoinPostback } from "../../../../lib/line-invite";

export const runtime = "nodejs";

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
  postback?: { data?: string };
};

export async function POST(request: Request) {
  const body = await request.text();
  try {
    if (!verifyLineWebhookSignature(body, request.headers.get("x-line-signature"))) {
      return new Response("Invalid signature", { status: 401 });
    }
    const payload = JSON.parse(body) as {
      events?: LineWebhookEvent[];
    };
    const db = getDb();
    for (const event of payload.events ?? []) {
      const lineUserId = event.source?.userId;
      if (!lineUserId) continue;
      if (event.type === "follow") {
        const [followedUser] = await db.update(users).set({ lineFollowed: true, updatedAt: new Date() }).where(eq(users.lineUserId, lineUserId)).returning({ id: users.id });
        if (followedUser) await recordFunnelEvent(db, request, "line_followed", {
          userId: followedUser.id,
          visitorId: followedUser.id,
          dedupeKey: `line_followed:${followedUser.id}`,
        });
      } else if (event.type === "unfollow") {
        await db.update(users).set({ lineFollowed: false, updatedAt: new Date() }).where(eq(users.lineUserId, lineUserId));
      } else if (event.type === "message" && event.message?.type === "text" && typeof event.message.text === "string") {
        // Only Setlog invitations get a reaction; ordinary chat text is ignored.
        await handleLineInviteMessage({ lineUserId, replyToken: event.replyToken, text: event.message.text });
      } else if (event.type === "postback" && typeof event.postback?.data === "string") {
        const params = new URLSearchParams(event.postback.data);
        const pairId = params.get("pairId");
        if (params.get("action") === "join_setlog" && pairId) {
          await handleLineJoinPostback({ lineUserId, replyToken: event.replyToken, pairId });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "LINE_WEBHOOK_UNAVAILABLE" }, { status: 503 });
  }
}
