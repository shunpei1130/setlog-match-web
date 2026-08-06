import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "../../../../lib/auth";
import { generateStateToken } from "../../../../lib/crypto";
import { buildLineLoginUrl } from "../../../../lib/line";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  try {
    const state = generateStateToken();
    const response = NextResponse.redirect(buildLineLoginUrl(state));
    response.headers.append(
      "Set-Cookie",
      `setlog_line_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax;${process.env.NODE_ENV === "production" ? " Secure;" : ""}`,
    );
    return response;
  } catch {
    return NextResponse.json({ error: "LINE_UNAVAILABLE" }, { status: 503 });
  }
}
