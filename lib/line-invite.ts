import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { eventPairMembers, eventPairs, users } from "../db/schema";
import { LifecycleError, confirmSetlogJoined, saveSetlogInvite } from "./lifecycle";
import { extractSetlogInvite } from "./setlog-invite";
import { replyLineMessage } from "./line";
import { notifyInviteJoined, notifyPartnerInviteShared } from "./invite-notifications";

// The LINE chat invite flow: a participant pastes the text produced by the
// Setlog share button into the official account chat, and the invite is saved
// through the same lifecycle logic the pair screen uses, so both entry points
// behave identically (first saver wins, only the saver may replace, locked
// once the partner has confirmed joining).

type LineEventContext = {
  lineUserId: string;
  replyToken?: string;
};

async function reply(context: LineEventContext, text: string) {
  if (!context.replyToken) return;
  try {
    await replyLineMessage(context.replyToken, [{ type: "text", text }]);
  } catch {
    // Replies are best-effort; the saved state is what matters.
  }
}

async function findUserId(lineUserId: string): Promise<string | null> {
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.lineUserId, lineUserId))
    .limit(1);
  return user?.id ?? null;
}

export async function findActivePairIdForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const { rows } = await db.execute<{ id: string }>(sql`
    SELECT p.id
    FROM event_pairs p
    JOIN events e ON e.id = p.event_id
    WHERE e.kind = 'weekly'
      AND p.status = 'published'
      AND (p.participant_a_id = ${userId}::uuid OR p.participant_b_id = ${userId}::uuid)
      AND e.starts_at <= now()
      AND e.starts_at + interval '11 hours' > now()
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE b.pair_id = p.id
          AND (b.blocker_user_id = ${userId}::uuid OR b.blocked_user_id = ${userId}::uuid)
      )
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

async function currentInvite(pairId: string) {
  const db = getDb();
  const [pair] = await db
    .select({ code: eventPairs.setlogCode, submittedBy: eventPairs.inviteSubmittedBy })
    .from(eventPairs)
    .where(eq(eventPairs.id, pairId))
    .limit(1);
  return pair ?? null;
}

function saveErrorMessage(error: LifecycleError): string {
  switch (error.code) {
    case "SETLOG_INVITE_ALREADY_SAVED":
      return "すでに相手が招待を共有しています。相手から届いた招待コードで、Setlogに参加してください。";
    case "SETLOG_INVITE_LOCKED":
      return "相手が参加確認済みのため、招待は変更できません。";
    case "SETLOG_INVITE_CLOSED":
      return "招待を共有できるのは、土曜12:00〜22:00です。今は受け付けていません。";
    case "PAIR_NOT_FOUND":
    case "PAIR_NOT_AVAILABLE":
      return "今日のペアが見つかりませんでした。マッチングが成立したあとに、もう一度送ってください。";
    default:
      return "招待を受け付けられませんでした。時間をおいて、もう一度お試しください。";
  }
}

// Returns true when the text contained an invitation (and was handled);
// unrelated chat text returns false so the caller can stay silent.
export async function handleLineInviteMessage(context: LineEventContext & { text: string }): Promise<boolean> {
  const invite = extractSetlogInvite(context.text);
  if (!invite) return false;
  const userId = await findUserId(context.lineUserId);
  if (!userId) {
    await reply(context, "set-mobの登録が見つかりませんでした。先にset-mobでLINE連携と参加登録をしてください。");
    return true;
  }
  const pairId = await findActivePairIdForUser(userId);
  if (!pairId) {
    await reply(context, "今日のペアがまだ決まっていません。マッチングが成立したあとに、もう一度送ってください。");
    return true;
  }
  const before = await currentInvite(pairId);
  try {
    await saveSetlogInvite(pairId, userId, invite.url);
  } catch (error) {
    if (error instanceof LifecycleError) {
      await reply(context, saveErrorMessage(error));
      return true;
    }
    throw error;
  }
  if (before?.code === invite.code && before?.submittedBy === userId) {
    await reply(context, "この招待は、すでに相手に送られています。");
    return true;
  }
  if (before?.code === invite.code) {
    await reply(context, "この招待は、すでに相手が共有しています。Setlogに参加できたら、届いたメッセージの「Setlogに参加した」を押してください。");
    return true;
  }
  await notifyPartnerInviteShared(pairId, userId);
  await reply(
    context,
    before?.code
      ? `招待を変更して、相手に送り直しました。\n招待コード: ${invite.code}`
      : `招待を受け取りました。相手に招待コードを送りました。\n招待コード: ${invite.code}`,
  );
  return true;
}

export async function handleLineJoinPostback(context: LineEventContext & { pairId: string }): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.pairId)) return false;
  const userId = await findUserId(context.lineUserId);
  if (!userId) {
    await reply(context, "set-mobの登録が見つかりませんでした。先にset-mobでLINE連携と参加登録をしてください。");
    return true;
  }
  const db = getDb();
  const [ownMember] = await db
    .select({ joinedAt: eventPairMembers.joinedAt })
    .from(eventPairMembers)
    .where(and(eq(eventPairMembers.pairId, context.pairId), eq(eventPairMembers.userId, userId)))
    .limit(1);
  if (!ownMember) {
    await reply(context, "対象のペアが見つかりませんでした。");
    return true;
  }
  if (ownMember.joinedAt) {
    await reply(context, "すでに参加確認済みです。");
    return true;
  }
  try {
    await confirmSetlogJoined(context.pairId, userId);
  } catch (error) {
    if (error instanceof LifecycleError) {
      await reply(context, "参加確認できる時間が過ぎているか、まだ招待が共有されていません。");
      return true;
    }
    throw error;
  }
  await notifyInviteJoined(context.pairId, userId);
  await reply(context, "参加を記録しました。招待を共有した相手にも伝えました。");
  return true;
}
