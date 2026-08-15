import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { mergeAttribution, normalizeAttribution, readAttribution, readVisitorId, recordFunnelEvent, setTrackingCookies } from "../../../../lib/analytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const incoming = normalizeAttribution(await request.json().catch(() => null));
  const attribution = mergeAttribution(readAttribution(request), incoming);
  const visitorId = readVisitorId(request) ?? crypto.randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  let tracked = false;
  try {
    tracked = await recordFunnelEvent(getDb(), request, "qualified_visit", {
      visitorId,
      attribution,
      dedupeKey: `qualified_visit:${visitorId}:${day}`,
    });
  } catch {
    // Attribution cookies still work while analytics storage is temporarily unavailable.
  }
  const response = NextResponse.json({ tracked });
  setTrackingCookies(response, visitorId, attribution);
  return response;
}
