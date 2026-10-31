import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { eventPairs, users } from "../db/schema";
import { pushLineMessage, pushLineMessages } from "./line";
import { inviteSharedMessage } from "./invite-message";

export { inviteSharedMessage } from "./invite-message";

// LINE notifications around the Setlog invite flow. They are shared by every
// entry point (web/LIFF pair screen and the LINE chat flow) so the partner
// always hears the same thing. Every function is failure-isolated: a failed
// or unavailable push never fails the invite save / join confirmation that
// triggered it, and nothing is sent in the review environment.

function notificationsDisabled() {
  return process.env.APP_ENV === "review";
}

type PairContacts = {
  participantAId: string;
  participantBId: string;
  inviteSubmittedBy: string | null;
  setlogUrl: string | null;
  setlogCode: string | null;
};

async function loadPairContacts(pairId: string): Promise<PairContacts | null> {
  const db = getDb();
  const [pair] = await db
    .select({
      participantAId: eventPairs.participantAId,
      participantBId: eventPairs.participantBId,
      inviteSubmittedBy: eventPairs.inviteSubmittedBy,
      setlogUrl: eventPairs.setlogUrl,
      setlogCode: eventPairs.setlogCode,
    })
    .from(eventPairs)
    .where(eq(eventPairs.id, pairId))
    .limit(1);
  return pair ?? null;
}

async function lineTarget(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const db = getDb();
  const [user] = await db
    .select({ lineUserId: users.lineUserId, lineFollowed: users.lineFollowed })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.lineFollowed && user.lineUserId ? user.lineUserId : null;
}

export async function notifyPartnerInviteShared(pairId: string, actorUserId: string): Promise<boolean> {
  if (notificationsDisabled()) return false;
  try {
    const pair = await loadPairContacts(pairId);
    if (!pair?.setlogCode || !pair.setlogUrl) return false;
    const partnerId = pair.participantAId === actorUserId
      ? pair.participantBId
      : pair.participantBId === actorUserId
        ? pair.participantAId
        : null;
    if (!partnerId) return false;
    const target = await lineTarget(partnerId);
    if (!target) return false;
    await pushLineMessages(target, [inviteSharedMessage(pairId, pair.setlogCode, pair.setlogUrl)]);
    return true;
  } catch {
    return false;
  }
}

export async function notifyInviteJoined(pairId: string, actorUserId: string): Promise<boolean> {
  if (notificationsDisabled()) return false;
  try {
    const pair = await loadPairContacts(pairId);
    if (!pair?.inviteSubmittedBy || pair.inviteSubmittedBy === actorUserId) return false;
    const target = await lineTarget(pair.inviteSubmittedBy);
    if (!target) return false;
    await pushLineMessage(target, "相手がSetlogに参加しました。\n今日の振り返りは、22:00〜23:00に回答できます。\n\nset-mob");
    return true;
  } catch {
    return false;
  }
}
