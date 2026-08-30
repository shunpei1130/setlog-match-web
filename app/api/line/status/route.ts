import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getApiAuthUser } from "../../../../lib/auth";
import { checkLineFriendship } from "../../../../lib/line";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  let followed = user.lineFollowed;
  if (user.lineUserId && process.env.LINE_MESSAGING_ACCESS_TOKEN) {
    try {
      const currentFollowed = await checkLineFriendship(user.lineUserId);
      followed = currentFollowed;
      if (currentFollowed !== user.lineFollowed) {
        await getDb().update(users)
          .set({ lineFollowed: currentFollowed, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }
    } catch {
      // Keep the last known state when the LINE API is temporarily unavailable.
    }
  }

  return NextResponse.json({
    linked: Boolean(user.lineUserId),
    followed,
    displayName: user.lineUserId ? undefined : null,
    officialAccountUrl: process.env.LINE_OFFICIAL_ACCOUNT_URL ?? null,
  });
}
