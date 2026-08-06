import { and, eq, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { eventPairs, eventRegistrations } from "../../../../../db/schema";
import { getCurrentAuthUser, isAdminEmail } from "../../../../../lib/auth";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentAuthUser();
  return user && isAdminEmail(user.email) ? user : null;
}

function normalizeSetlogUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSetlogCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code.length > 0 && code.length <= 120 ? code : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pairId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const { pairId } = await params;
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    setlogUrl?: unknown;
    setlogCode?: unknown;
    participantAId?: unknown;
    participantBId?: unknown;
  } | null;
  const action = body?.action;
  if (action !== "publish" && action !== "unpublish" && action !== "close" && action !== "block" && action !== "update") {
    return NextResponse.json({ error: "PAIR_ACTION_INVALID" }, { status: 400 });
  }
  try {
    const db = getDb();
    const existing = await db.query.eventPairs.findFirst({ where: eq(eventPairs.id, pairId) });
    if (!existing) return NextResponse.json({ error: "PAIR_NOT_FOUND" }, { status: 404 });

    const hasSetlogUrl = Object.prototype.hasOwnProperty.call(body ?? {}, "setlogUrl");
    const hasSetlogCode = Object.prototype.hasOwnProperty.call(body ?? {}, "setlogCode");
    const setlogUrl = hasSetlogUrl ? normalizeSetlogUrl(body?.setlogUrl) : existing.setlogUrl;
    const setlogCode = hasSetlogCode ? normalizeSetlogCode(body?.setlogCode) : existing.setlogCode;

    if (action === "update") {
      if (existing.status !== "draft") {
        return NextResponse.json({ error: "PAIR_MUST_BE_DRAFT" }, { status: 409 });
      }
      const participantAId = typeof body?.participantAId === "string" ? body.participantAId : existing.participantAId;
      const participantBId = typeof body?.participantBId === "string" ? body.participantBId : existing.participantBId;
      if (!participantAId || !participantBId || participantAId === participantBId) {
        return NextResponse.json({ error: "PAIR_PARTICIPANTS_INVALID" }, { status: 400 });
      }
      const registrations = await db.select({ userId: eventRegistrations.userId })
        .from(eventRegistrations)
        .where(and(
          eq(eventRegistrations.eventId, existing.eventId),
          eq(eventRegistrations.status, "waiting"),
        ));
      const registeredIds = new Set(registrations.map((registration) => registration.userId).filter(Boolean));
      if (!registeredIds.has(participantAId) || !registeredIds.has(participantBId)) {
        return NextResponse.json({ error: "PAIR_PARTICIPANT_NOT_REGISTERED" }, { status: 400 });
      }
      const occupied = await db.select({ id: eventPairs.id }).from(eventPairs).where(and(
        eq(eventPairs.eventId, existing.eventId),
        ne(eventPairs.id, pairId),
        or(
          eq(eventPairs.participantAId, participantAId),
          eq(eventPairs.participantBId, participantAId),
          eq(eventPairs.participantAId, participantBId),
          eq(eventPairs.participantBId, participantBId),
        ),
      )).limit(1);
      if (occupied.length > 0) return NextResponse.json({ error: "PAIR_PARTICIPANT_ALREADY_PAIRED" }, { status: 409 });
      const [pair] = await db.update(eventPairs).set({
        participantAId,
        participantBId,
        setlogUrl,
        setlogCode,
        updatedAt: new Date(),
      }).where(eq(eventPairs.id, pairId)).returning();
      return NextResponse.json({ pair });
    }

    if (action === "publish" && (!setlogUrl || !setlogCode)) {
      return NextResponse.json({ error: "SETLOG_ACCESS_REQUIRED" }, { status: 400 });
    }
    if (action === "publish" && existing.status === "blocked") {
      return NextResponse.json({ error: "PAIR_BLOCKED" }, { status: 409 });
    }
    const nextStatus = action === "publish"
      ? "published"
      : action === "unpublish"
        ? "draft"
        : action === "close"
          ? "closed"
          : "blocked";
    const [pair] = await db.update(eventPairs).set({
      status: nextStatus,
      setlogUrl: action === "publish" ? setlogUrl : existing.setlogUrl,
      setlogCode: action === "publish" ? setlogCode : existing.setlogCode,
      publishedAt: action === "publish" ? new Date() : action === "unpublish" ? null : existing.publishedAt,
      updatedAt: new Date(),
    }).where(eq(eventPairs.id, pairId)).returning();
    if (!pair) return NextResponse.json({ error: "PAIR_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ pair });
  } catch {
    return NextResponse.json({ error: "PAIR_UPDATE_UNAVAILABLE" }, { status: 503 });
  }
}
