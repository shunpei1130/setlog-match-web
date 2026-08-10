import { NextResponse } from "next/server";
import { verifyAuthenticationCode } from "../../../../../lib/auth-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  try {
    const result = await verifyAuthenticationCode(body?.email, body?.code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      authenticated: true,
      accessToken: result.session.rawToken,
      expiresAt: result.session.expiresAt.toISOString(),
      user: result.user,
    });
  } catch {
    return NextResponse.json({ error: "AUTH_VERIFICATION_UNAVAILABLE" }, { status: 503 });
  }
}
