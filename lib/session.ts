import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "setlog_session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export async function getOrCreateSessionId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { sessionId: existing, shouldSetCookie: false };
  }

  return { sessionId: crypto.randomUUID(), shouldSetCookie: true };
}

export function setSessionCookie(response: Response, sessionId: string) {
  const cookieValue = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  response.headers.append("Set-Cookie", cookieValue);
}
