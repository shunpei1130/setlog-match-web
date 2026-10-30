import { NextResponse } from "next/server";
import { clearAuthCookie, getApiAuthUser, getCurrentAuthUser } from "../../../lib/auth";
import { deleteUserAccount } from "../../../lib/lifecycle";

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

export async function DELETE(request: Request) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    await deleteUserAccount(user.id, user.email);
    const response = NextResponse.json({ deleted: true });
    clearAuthCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: "ACCOUNT_DELETE_UNAVAILABLE" }, { status: 503 });
  }
}
