import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { lineLoginStates } from "../../../../../db/schema";
import { getApiAuthUser } from "../../../../../lib/auth";
import { generateStateToken, hashSecret } from "../../../../../lib/crypto";
import { buildLineLoginUrl } from "../../../../../lib/line";

export const runtime = "nodejs";

const MOBILE_LINE_STATE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const state = `m_${generateStateToken()}`;
    const expiresAt = new Date(Date.now() + MOBILE_LINE_STATE_TTL_MS);
    await getDb().insert(lineLoginStates).values({
      userId: user.id,
      stateHash: hashSecret(state),
      expiresAt,
    });
    return NextResponse.json({
      authorizeUrl: buildLineLoginUrl(state),
      redirectUrl: "setlogmatch://line-callback",
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "LINE_UNAVAILABLE" }, { status: 503 });
  }
}
