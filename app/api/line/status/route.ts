import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  return NextResponse.json({
    linked: Boolean(user.lineUserId),
    followed: user.lineFollowed,
    displayName: user.lineUserId ? undefined : null,
    officialAccountUrl: process.env.LINE_OFFICIAL_ACCOUNT_URL ?? null,
  });
}
