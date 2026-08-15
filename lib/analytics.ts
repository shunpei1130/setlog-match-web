import type { getDb } from "../db";
import { funnelEvents } from "../db/schema";

type Database = ReturnType<typeof getDb>;
export type FunnelEvent = typeof funnelEvents.$inferInsert["eventName"];

export const VISITOR_COOKIE_NAME = "set_mob_visitor";
export const ATTRIBUTION_COOKIE_NAME = "set_mob_attribution";
const TRACKING_MAX_AGE = 60 * 60 * 24 * 90;

export type Attribution = {
  refCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
};

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function clean(value: unknown, maxLength: number, pattern?: RegExp) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  if (!normalized || (pattern && !pattern.test(normalized))) return null;
  return normalized;
}

export function normalizeAttribution(input: unknown): Attribution {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    refCode: clean(value.refCode ?? value.ref, 80, /^[A-Za-z0-9._-]+$/),
    utmSource: clean(value.utmSource ?? value.utm_source, 120),
    utmMedium: clean(value.utmMedium ?? value.utm_medium, 120),
    utmCampaign: clean(value.utmCampaign ?? value.utm_campaign, 120),
    landingPath: clean(value.landingPath, 240, /^\//),
  };
}

export function readAttribution(request: Request): Attribution {
  const encoded = cookieValue(request, ATTRIBUTION_COOKIE_NAME);
  if (!encoded) return normalizeAttribution(null);
  try {
    return normalizeAttribution(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    return normalizeAttribution(null);
  }
}

export function readVisitorId(request: Request) {
  const value = cookieValue(request, VISITOR_COOKIE_NAME);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function mergeAttribution(existing: Attribution, incoming: Attribution): Attribution {
  return {
    refCode: existing.refCode ?? incoming.refCode,
    utmSource: existing.utmSource ?? incoming.utmSource,
    utmMedium: existing.utmMedium ?? incoming.utmMedium,
    utmCampaign: existing.utmCampaign ?? incoming.utmCampaign,
    landingPath: existing.landingPath ?? incoming.landingPath,
  };
}

export function setTrackingCookies(response: Response, visitorId: string, attribution: Attribution) {
  const options = [
    "Path=/",
    `Max-Age=${TRACKING_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ].filter(Boolean).join("; ");
  response.headers.append("Set-Cookie", `${VISITOR_COOKIE_NAME}=${visitorId}; ${options}`);
  response.headers.append("Set-Cookie", `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(attribution))}; ${options}`);
}

export async function recordFunnelEvent(
  db: Database,
  request: Request,
  eventName: FunnelEvent,
  options: { userId?: string | null; eventId?: string | null; dedupeKey?: string | null; visitorId?: string | null; attribution?: Attribution } = {},
) {
  const visitorId = options.visitorId ?? readVisitorId(request);
  if (!visitorId) return false;
  const attribution = options.attribution ?? readAttribution(request);
  try {
    await db.insert(funnelEvents).values({
      visitorId,
      userId: options.userId ?? null,
      eventId: options.eventId ?? null,
      eventName,
      refCode: attribution.refCode,
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      landingPath: attribution.landingPath,
      dedupeKey: options.dedupeKey ?? null,
    }).onConflictDoNothing({ target: funnelEvents.dedupeKey });
    return true;
  } catch {
    return false;
  }
}
