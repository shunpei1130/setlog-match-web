import { and, eq, or, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { blocks, contactDisclosures, pairDecisions } from "../db/schema";

type Database = ReturnType<typeof getDb>;

export type PairDecisionInput = {
  instagram: boolean;
  line: boolean;
  continue: boolean;
  none: boolean;
};

export type PairResult =
  | { kind: "pending"; items: []; contacts: null }
  | { kind: "ended"; items: []; contacts: null }
  | { kind: "continued"; items: ["continue"]; contacts: null }
  | { kind: "disclosed"; items: Array<"instagram" | "line">; contacts: { instagram?: string; line?: string } };

export type PairView = {
  id: string;
  eventKey: string;
  status: "draft" | "published" | "closed" | "blocked";
  setlogUrl: string | null;
  setlogCode: string | null;
  candidate: {
    id: string;
    nickname: string;
    faculty: string;
    academicYear: string;
    gender: string;
  };
  decision: (PairDecisionInput & { answered: boolean }) | null;
  partnerAnswered: boolean;
  result: PairResult | null;
};

type PairRow = {
  id: string;
  eventKey: string;
  status: PairView["status"];
  setlogUrl: string | null;
  setlogCode: string | null;
  participantAId: string;
  participantBId: string;
  aNickname: string | null;
  aFaculty: string | null;
  aAcademicYear: string | null;
  aGender: string | null;
  bNickname: string | null;
  bFaculty: string | null;
  bAcademicYear: string | null;
  bGender: string | null;
  aInstagram: string | null;
  aLine: string | null;
  bInstagram: string | null;
  bLine: string | null;
};

function rowToParticipant(row: PairRow, id: string) {
  const isA = row.participantAId === id;
  return {
    id: isA ? row.participantBId : row.participantAId,
    nickname: (isA ? row.bNickname : row.aNickname) ?? "参加者",
    faculty: (isA ? row.bFaculty : row.aFaculty) ?? "",
    academicYear: (isA ? row.bAcademicYear : row.aAcademicYear) ?? "",
    gender: (isA ? row.bGender : row.aGender) ?? "other",
  };
}

function contactFor(row: PairRow, userId: string, channel: "instagram" | "line") {
  const isA = row.participantAId === userId;
  return channel === "instagram"
    ? (isA ? row.aInstagram : row.bInstagram)
    : (isA ? row.aLine : row.bLine);
}

function decisionValues(decision: typeof pairDecisions.$inferSelect | undefined): PairView["decision"] {
  if (!decision) return null;
  return {
    instagram: decision.instagram,
    line: decision.line,
    continue: decision.continueChoice,
    none: decision.none,
    answered: decision.answered,
  };
}

export function validateDecision(input: unknown): PairDecisionInput | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<Record<"instagram" | "line" | "continue" | "none", unknown>>;
  const result = {
    instagram: candidate.instagram === true,
    line: candidate.line === true,
    continue: candidate.continue === true,
    none: candidate.none === true,
  };
  if (result.none) {
    result.instagram = false;
    result.line = false;
    result.continue = false;
  }
  if (!result.none && !result.instagram && !result.line && !result.continue) return null;
  return result;
}

export function resolvePairResult(
  left: PairDecisionInput | undefined,
  right: PairDecisionInput | undefined,
  row: PairRow,
  currentUserId: string,
): PairResult {
  if (!left || !right) return { kind: "pending", items: [], contacts: null };
  if (left.none || right.none) return { kind: "ended", items: [], contacts: null };
  const items = (["instagram", "line"] as const).filter((channel) => left[channel] && right[channel]);
  const continueBoth = left.continue && right.continue;
  if (items.length === 0 && continueBoth) return { kind: "continued", items: ["continue"], contacts: null };
  if (items.length === 0) return { kind: "ended", items: [], contacts: null };
  const contacts: { instagram?: string; line?: string } = {};
  for (const channel of items) {
    const ownContact = contactFor(row, currentUserId, channel);
    const partnerId = row.participantAId === currentUserId ? row.participantBId : row.participantAId;
    const partnerContact = contactFor(row, partnerId, channel);
    if (ownContact && partnerContact) contacts[channel] = partnerContact;
  }
  return { kind: "disclosed", items, contacts };
}

async function findPairRow(db: Database, pairId: string): Promise<PairRow | null> {
  const rows = await db.execute(sqlPairRow(pairId));
  return (rows as unknown as PairRow[])[0] ?? null;
}

function sqlPairRow(pairId: string) {
  // Kept in a helper so all participant-facing reads select only profile-safe fields.
  return sql`
    SELECT
      p.id,
      e.event_key AS "eventKey",
      p.status,
      p.setlog_url AS "setlogUrl",
      p.setlog_code AS "setlogCode",
      p.participant_a_id AS "participantAId",
      p.participant_b_id AS "participantBId",
      ra.nickname AS "aNickname",
      ra.faculty AS "aFaculty",
      ra.academic_year AS "aAcademicYear",
      ra.gender AS "aGender",
      rb.nickname AS "bNickname",
      rb.faculty AS "bFaculty",
      rb.academic_year AS "bAcademicYear",
      rb.gender AS "bGender",
      ua.instagram_handle AS "aInstagram",
      ua.line_contact AS "aLine",
      ub.instagram_handle AS "bInstagram",
      ub.line_contact AS "bLine"
    FROM event_pairs p
    JOIN events e ON e.id = p.event_id
    JOIN users ua ON ua.id = p.participant_a_id
    JOIN users ub ON ub.id = p.participant_b_id
    LEFT JOIN event_registrations ra ON ra.event_id = p.event_id AND ra.user_id = p.participant_a_id
    LEFT JOIN event_registrations rb ON rb.event_id = p.event_id AND rb.user_id = p.participant_b_id
    WHERE p.id = ${pairId}::uuid
    LIMIT 1
  `;
}

async function getDecisionRows(db: Database, pairId: string) {
  return await db.select().from(pairDecisions).where(eq(pairDecisions.pairId, pairId));
}

export async function getPairViewForUser(db: Database, pairId: string, userId: string): Promise<PairView | null> {
  const row = await findPairRow(db, pairId);
  if (!row || (row.participantAId !== userId && row.participantBId !== userId)) return null;
  if (row.status !== "published") return null;
  const blocked = await db.select({ id: blocks.id }).from(blocks).where(and(
    eq(blocks.pairId, pairId),
    or(eq(blocks.blockerUserId, userId), eq(blocks.blockedUserId, userId)),
  )).limit(1);
  if (blocked.length > 0) return null;
  const decisions = await getDecisionRows(db, pairId);
  const ownDecision = decisions.find((decision) => decision.userId === userId);
  const partnerDecision = decisions.find((decision) => decision.userId !== userId);
  const left = decisions.find((decision) => decision.userId === row.participantAId);
  const right = decisions.find((decision) => decision.userId === row.participantBId);
  const result: PairResult | null = left?.answered && right?.answered
    ? resolvePairResult(
      { instagram: left.instagram, line: left.line, continue: left.continueChoice, none: left.none },
      { instagram: right.instagram, line: right.line, continue: right.continueChoice, none: right.none },
      row,
      userId,
    )
    : ownDecision?.answered
      ? { kind: "pending", items: [], contacts: null }
      : null;
  return {
    id: row.id,
    eventKey: row.eventKey,
    status: row.status,
    setlogUrl: row.setlogUrl,
    setlogCode: row.setlogCode,
    candidate: rowToParticipant(row, userId),
    decision: decisionValues(ownDecision),
    partnerAnswered: Boolean(partnerDecision?.answered),
    result,
  };
}

export async function getPublishedPairForUser(db: Database, eventKey: string, userId: string) {
  const rows = await db.execute(sql`
    SELECT p.id
    FROM event_pairs p
    JOIN events e ON e.id = p.event_id
    WHERE e.event_key = ${eventKey}
      AND p.status = 'published'
      AND (p.participant_a_id = ${userId}::uuid OR p.participant_b_id = ${userId}::uuid)
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE b.pair_id = p.id AND (b.blocker_user_id = ${userId}::uuid OR b.blocked_user_id = ${userId}::uuid)
      )
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT 1
  `);
  const [pair] = rows as unknown as Array<{ id: string }>;
  return pair ? getPairViewForUser(db, pair.id, userId) : null;
}

export async function recordDecision(db: Database, pairId: string, userId: string, decision: PairDecisionInput) {
  const [saved] = await db.insert(pairDecisions).values({
    pairId,
    userId,
    instagram: decision.instagram,
    line: decision.line,
    continueChoice: decision.continue,
    none: decision.none,
    answered: true,
    answeredAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [pairDecisions.pairId, pairDecisions.userId],
    set: {
      instagram: decision.instagram,
      line: decision.line,
      continueChoice: decision.continue,
      none: decision.none,
      answered: true,
      answeredAt: new Date(),
      updatedAt: new Date(),
    },
  }).returning({ id: pairDecisions.id });
  if (!saved) throw new Error("Decision could not be saved.");
}

export async function recordDisclosures(db: Database, pairId: string, row: PairRow, items: Array<"instagram" | "line">) {
  for (const channel of items) {
    await db.insert(contactDisclosures).values([
      { pairId, sourceUserId: row.participantAId, targetUserId: row.participantBId, channel },
      { pairId, sourceUserId: row.participantBId, targetUserId: row.participantAId, channel },
    ]).onConflictDoNothing();
  }
}

export async function recordDisclosuresForUser(
  db: Database,
  pairId: string,
  currentUserId: string,
  items: Array<"instagram" | "line">,
) {
  const row = await findPairRow(db, pairId);
  if (!row || (row.participantAId !== currentUserId && row.participantBId !== currentUserId)) return;
  await recordDisclosures(db, pairId, row, items);
}
