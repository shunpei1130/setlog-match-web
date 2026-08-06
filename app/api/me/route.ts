import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      lineLinked: Boolean(user.lineUserId),
      lineFollowed: user.lineFollowed,
      instagramHandle: Boolean(user.instagramHandle),
      lineContact: Boolean(user.lineContact),
    },
  });
}
