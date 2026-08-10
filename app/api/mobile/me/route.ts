import { NextResponse } from "next/server";
import { getApiAuthUser } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      lineLinked: Boolean(user.lineUserId),
      lineFollowed: user.lineFollowed,
      instagramHandle: user.instagramHandle,
      lineContact: user.lineContact,
    },
  });
}
