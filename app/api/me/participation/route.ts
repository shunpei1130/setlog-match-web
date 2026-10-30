import { NextResponse } from "next/server";
import { getApiAuthUser } from "../../../../lib/auth";
import { participationFor } from "../../../../lib/participation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const participation = await participationFor(user.id, new URL(request.url).searchParams.get("next") === "true");
    return NextResponse.json({ ...participation, contacts: { instagramHandle: user.instagramHandle, lineContact: user.lineContact } });
  } catch { return NextResponse.json({ error: "PARTICIPATION_UNAVAILABLE" }, { status: 503 }); }
}
