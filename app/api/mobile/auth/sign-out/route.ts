import { NextResponse } from "next/server";
import { getBearerToken, revokeAuthToken } from "../../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawToken = getBearerToken(request);
  if (!rawToken) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    await revokeAuthToken(rawToken);
  } catch {
    return NextResponse.json({ error: "SIGN_OUT_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json({ signedOut: true });
}
