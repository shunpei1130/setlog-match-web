import { createHash } from "node:crypto";
import type { Client } from "@neondatabase/serverless";
import { getDb, withLifecycleTransaction } from "../db";
import { sql } from "drizzle-orm";
import { isAllowedAuthEmail } from "./auth-email";
import { maximumMatching } from "./matching";
import { arePairPreferencesCompatible, type ProfileGender, type MatchPurpose, type GenderPreference, type RegistrationProfile, type RegistrationPreferences, type ContactHandles } from "./profile";
import { normalizeSetlogInvite } from "./setlog-invite";
import type { PairDecisionInput } from "./pair-result";
import { scheduleForEventKey } from "./event-schedule";

export class LifecycleError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}

export function automaticMatchingEnabled() {
  return process.env.AUTO_MATCHING_ENABLED === "true"
    || (process.env.NODE_ENV !== "production" && process.env.AUTO_MATCHING_ENABLED !== "false");
}

type Candidate = { user_id: string; email: string; gender: ProfileGender; purpose: MatchPurpose; preferred_gender: GenderPreference };
const orderKey = (seed: string, id: string) => createHash("sha256").update(`${seed}:${id}`).digest("hex");
const compatible = (a: Candidate, b: Candidate) => arePairPreferencesCompatible(
  { gender: a.gender, purpose: a.purpose, preferredGender: a.preferred_gender },
  { gender: b.gender, purpose: b.purpose, preferredGender: b.preferred_gender },
);
const pairKey = (a: string, b: string) => [a, b].sort().join(":");

export async function reserveQualifiedRegistration(eventId: string, sessionId: string, userId: string, profile: RegistrationProfile, preferences: RegistrationPreferences, contacts: ContactHandles) {
  return withLifecycleTransaction(async (client) => {
    const { rows: [event] } = await client.query("SELECT *,clock_timestamp() AS clock FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    if (!event || event.kind !== "weekly" || event.status !== "open" || new Date(event.clock) >= new Date(event.starts_at)) throw new LifecycleError("EVENT_REGISTRATION_CLOSED");
    const { rows: [user] } = await client.query("SELECT line_user_id,line_followed FROM users WHERE id=$1", [userId]);
    if (!user?.line_user_id || !user.line_followed) throw new LifecycleError("LINE_REGISTRATION_REQUIRED", 400);
    const { rows: [reservation] } = await client.query(`SELECT registered,waiting_count AS "waitingCount",capacity
      FROM register_event_waiting($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::match_purpose,$9::gender_preference)`,
    [eventId, sessionId, userId, profile.nickname, profile.faculty, profile.academicYear, profile.gender, preferences.purpose, preferences.preferredGender]);
    if (reservation.registered) {
      await client.query("UPDATE users SET instagram_handle=$2,line_contact=$3,updated_at=now() WHERE id=$1", [userId, contacts.instagramHandle, contacts.lineContact]);
      await client.query("UPDATE event_registrations SET line_status='registered',age_confirmed_at=now(),rules_accepted_at=now(),updated_at=now() WHERE event_id=$1 AND user_id=$2", [eventId, userId]);
    }
    return { registered: Boolean(reservation.registered), waitingCount: Number(reservation.waitingCount), capacity: Number(reservation.capacity) };
  });
}

export async function ensureAutomaticMatching(eventId: string) {
  if (!automaticMatchingEnabled()) return;
  const { rows: due } = await getDb().execute(sql`SELECT e.id FROM events e
    LEFT JOIN matching_runs r ON r.event_id=e.id WHERE e.id=${eventId}::uuid
    AND e.kind='weekly' AND e.status='open' AND e.starts_at<=now()
    AND e.starts_at+interval '11 hours'>now() AND r.event_id IS NULL`);
  if (!due.length) return;
  return withLifecycleTransaction(async (client) => {
    const { rows: [event] } = await client.query("SELECT *, clock_timestamp() AS clock FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    if (!event || event.kind !== "weekly" || event.status !== "open"
      || new Date(event.clock) < new Date(event.starts_at)
      || new Date(event.clock).getTime() >= new Date(event.starts_at).getTime() + 11 * 3600_000) return;
    const { rows: [done] } = await client.query("SELECT event_id FROM matching_runs WHERE event_id=$1", [eventId]);
    if (done) return;
    const { rows } = await client.query(`
      SELECT r.user_id, u.email, r.gender, r.purpose, r.preferred_gender
      FROM event_registrations r JOIN users u ON u.id=r.user_id
      WHERE r.event_id=$1 AND r.status='waiting' AND r.line_status='registered'
        AND r.age_confirmed_at IS NOT NULL AND r.rules_accepted_at IS NOT NULL
        AND u.email_verified_at IS NOT NULL AND u.line_followed AND u.line_user_id IS NOT NULL
        AND r.nickname IS NOT NULL AND r.faculty IS NOT NULL AND r.academic_year IS NOT NULL
        AND r.gender IN ('male','female','other')
      ORDER BY r.user_id`, [eventId]);
    const candidates = (rows as Candidate[]).filter((row) => isAllowedAuthEmail(row.email));
    candidates.sort((a, b) => orderKey(event.event_key, a.user_id).localeCompare(orderKey(event.event_key, b.user_id)));
    const { rows: excluded } = await client.query(`
      SELECT blocker_user_id AS a, blocked_user_id AS b FROM blocks
      UNION SELECT p.participant_a_id, p.participant_b_id FROM event_pairs p
        JOIN events e ON e.id=p.event_id
        WHERE (p.published_at IS NOT NULL AND e.starts_at < $1) OR p.status='blocked'
      UNION SELECT p.participant_a_id, p.participant_b_id FROM safety_reports s JOIN event_pairs p ON p.id=s.pair_id
    `, [event.starts_at]);
    const excludedKeys = new Set(excluded.map((row) => pairKey(row.a, row.b)));
    const { rows: existing } = await client.query("SELECT * FROM event_pairs WHERE event_id=$1", [eventId]);
    const occupied = new Set<string>();
    for (const pair of existing) {
      occupied.add(pair.participant_a_id); occupied.add(pair.participant_b_id);
      if (pair.status !== "draft") continue;
      const a = candidates.find((row) => row.user_id === pair.participant_a_id);
      const b = candidates.find((row) => row.user_id === pair.participant_b_id);
      if (!a || !b || !compatible(a, b) || excludedKeys.has(pairKey(a.user_id, b.user_id))) {
        throw new LifecycleError("EXISTING_PAIR_REQUIRES_REVIEW");
      }
      await client.query("UPDATE event_pairs SET status='published', published_at=now(), updated_at=now() WHERE id=$1", [pair.id]);
    }
    const available = candidates.filter((row) => !occupied.has(row.user_id));
    const graph = available.map((a, index) => available.flatMap((b, other) => (
      index !== other && compatible(a, b) && !excludedKeys.has(pairKey(a.user_id, b.user_id)) ? [other] : []
    )));
    const matches = maximumMatching(graph);
    let paired = existing.filter((row) => row.status === "published" || row.status === "draft").length * 2;
    for (let index = 0; index < matches.length; index += 1) {
      if (matches[index] <= index) continue;
      await client.query(`INSERT INTO event_pairs (event_id,participant_a_id,participant_b_id,status,published_at)
        VALUES ($1,$2,$3,'published',now())`, [eventId, available[index].user_id, available[matches[index]].user_id]);
      paired += 2;
    }
    await client.query(`INSERT INTO matching_runs (event_id,seed,eligible_count,paired_count)
      VALUES ($1,$2,$3,$4)`, [eventId, event.event_key, candidates.length, paired]);
  }, true);
}

async function participantPair(client: Client, pairId: string, userId: string) {
  const { rows: [pair] } = await client.query(`SELECT p.*, e.event_key, e.kind, e.starts_at, clock_timestamp() AS clock
    FROM event_pairs p JOIN events e ON e.id=p.event_id WHERE p.id=$1 FOR UPDATE OF p,e`, [pairId]);
  if (!pair || (pair.participant_a_id !== userId && pair.participant_b_id !== userId)) throw new LifecycleError("PAIR_NOT_FOUND", 404);
  if (pair.status !== "published") throw new LifecycleError("PAIR_NOT_AVAILABLE", 404);
  const { rows: blocked } = await client.query(`SELECT 1 FROM blocks WHERE
    (blocker_user_id=$1 AND blocked_user_id=$2) OR (blocker_user_id=$2 AND blocked_user_id=$1)`, [pair.participant_a_id, pair.participant_b_id]);
  if (blocked.length) throw new LifecycleError("PAIR_NOT_AVAILABLE", 404);
  return pair;
}

export async function saveSetlogInvite(pairId: string, userId: string, input: unknown) {
  const invite = normalizeSetlogInvite(input);
  if (!invite) throw new LifecycleError("SETLOG_INVITE_INVALID", 400);
  await withLifecycleTransaction(async (client) => {
    const pair = await participantPair(client, pairId, userId);
    const elapsed = new Date(pair.clock).getTime() - new Date(pair.starts_at).getTime();
    if (elapsed < 0 || elapsed >= 10 * 3600_000) throw new LifecycleError("SETLOG_INVITE_CLOSED");
    if (pair.setlog_code === invite.code) return;
    if (pair.setlog_code && pair.invite_submitted_by !== userId) throw new LifecycleError("SETLOG_INVITE_ALREADY_SAVED");
    const { rows: joined } = await client.query("SELECT 1 FROM event_pair_members WHERE pair_id=$1 AND user_id<>$2 AND joined_at IS NOT NULL", [pairId, userId]);
    if (joined.length) throw new LifecycleError("SETLOG_INVITE_LOCKED");
    await client.query("UPDATE event_pairs SET setlog_url=$2,setlog_code=$3,invite_submitted_by=$4,updated_at=now() WHERE id=$1", [pairId, invite.url, invite.code, userId]);
  });
}

export async function confirmSetlogJoined(pairId: string, userId: string) {
  await withLifecycleTransaction(async (client) => {
    const pair = await participantPair(client, pairId, userId);
    const elapsed = new Date(pair.clock).getTime() - new Date(pair.starts_at).getTime();
    if (!pair.setlog_code || elapsed < 0 || elapsed >= 11 * 3600_000) throw new LifecycleError("SETLOG_INVITE_CLOSED");
    await client.query("UPDATE event_pair_members SET joined_at=coalesce(joined_at,now()) WHERE pair_id=$1 AND user_id=$2", [pairId, userId]);
  });
}

async function reserveSunday(client: Client, pair: Record<string, unknown>) {
  const startsAt = new Date(new Date(pair.starts_at as string).getTime() + 24 * 3600_000);
  const jst = new Date(scheduleForEventKey(pair.event_key as string).startsAt.getTime() + 24 * 3600_000 + 9 * 3600_000);
  const key = `sun-${jst.toISOString().slice(0, 10)}`;
  await client.query(`INSERT INTO events (event_key,kind,starts_at) VALUES ($1,'extension',$2) ON CONFLICT (event_key) DO NOTHING`, [key, startsAt]);
  const { rows: [event] } = await client.query("SELECT id FROM events WHERE event_key=$1 FOR UPDATE", [key]);
  const { rows: [existing] } = await client.query("SELECT source_pair_id FROM pair_extensions WHERE source_pair_id=$1", [pair.id]);
  if (existing) return;
  await client.query(`INSERT INTO event_registrations
    (event_id,user_id,session_id,status,line_status,nickname,faculty,academic_year,gender,purpose,preferred_gender,age_confirmed_at,rules_accepted_at)
    SELECT $1,user_id,gen_random_uuid(),'waiting',line_status,nickname,faculty,academic_year,gender,purpose,preferred_gender,age_confirmed_at,rules_accepted_at
    FROM event_registrations WHERE event_id=$2 AND user_id IN ($3,$4)`, [event.id, pair.event_id, pair.participant_a_id, pair.participant_b_id]);
  const { rows: [target] } = await client.query(`INSERT INTO event_pairs
    (event_id,participant_a_id,participant_b_id,status,published_at,setlog_url,setlog_code,invite_submitted_by)
    VALUES ($1,$2,$3,'published',now(),$4,$5,$6) RETURNING id`,
  [event.id, pair.participant_a_id, pair.participant_b_id, pair.setlog_url, pair.setlog_code, pair.invite_submitted_by]);
  await client.query("INSERT INTO pair_extensions (source_pair_id,target_pair_id,event_id) VALUES ($1,$2,$3)", [pair.id, target.id, event.id]);
  await client.query("UPDATE events SET waiting_count=(SELECT count(*) FROM event_registrations WHERE event_id=$1 AND status='waiting' AND line_status='registered') WHERE id=$1", [event.id]);
}

export async function submitPairDecision(pairId: string, userId: string, decision: PairDecisionInput) {
  await withLifecycleTransaction(async (client) => {
    const pair = await participantPair(client, pairId, userId);
    const elapsed = new Date(pair.clock).getTime() - new Date(pair.starts_at).getTime();
    if (elapsed < 10 * 3600_000) throw new LifecycleError("DECISION_NOT_OPEN");
    if (elapsed >= 11 * 3600_000) throw new LifecycleError("DECISION_CLOSED");
    if (pair.finalized_at) {
      const { rows: [own] } = await client.query("SELECT * FROM pair_decisions WHERE pair_id=$1 AND user_id=$2", [pairId, userId]);
      if (own?.answered && own.instagram === decision.instagram && own.line === decision.line
        && own.continue_choice === decision.continue && own.none === decision.none) return;
      throw new LifecycleError("DECISION_FINALIZED");
    }
    if (pair.kind === "extension" && decision.continue) throw new LifecycleError("EXTENSION_LIMIT_REACHED", 400);
    const { rows: [user] } = await client.query("SELECT instagram_handle,line_contact FROM users WHERE id=$1", [userId]);
    if (decision.instagram && !user.instagram_handle) throw new LifecycleError("INSTAGRAM_CONTACT_REQUIRED", 400);
    if (decision.line && !user.line_contact) throw new LifecycleError("LINE_CONTACT_REQUIRED", 400);
    await client.query(`INSERT INTO pair_decisions (pair_id,user_id,instagram,line,continue_choice,none,answered,answered_at)
      VALUES ($1,$2,$3,$4,$5,$6,true,now()) ON CONFLICT (pair_id,user_id) DO UPDATE
      SET instagram=excluded.instagram,line=excluded.line,continue_choice=excluded.continue_choice,
        none=excluded.none,answered=true,answered_at=now(),updated_at=now()`,
    [pairId, userId, decision.instagram, decision.line, decision.continue, decision.none]);
    const { rows: answers } = await client.query("SELECT * FROM pair_decisions WHERE pair_id=$1 AND answered", [pairId]);
    if (answers.length !== 2) return;
    if (answers.every((answer) => answer.continue_choice && !answer.none)) await reserveSunday(client, pair);
    await client.query("UPDATE event_pairs SET finalized_at=now(),updated_at=now() WHERE id=$1", [pairId]);
  });
}

async function cancelExtensions(client: Client, pairIds: string[]) {
  const { rows: reservations } = await client.query(`UPDATE pair_extensions SET status='cancelled'
    WHERE status='reserved' AND (source_pair_id=ANY($1::uuid[]) OR target_pair_id=ANY($1::uuid[]))
    RETURNING target_pair_id,event_id`, [pairIds]);
  for (const reservation of reservations) {
    await client.query("UPDATE event_pairs SET status='closed',updated_at=now() WHERE id=$1", [reservation.target_pair_id]);
    await client.query(`UPDATE event_registrations SET status='cancelled',updated_at=now() WHERE event_id=$1
      AND user_id IN (SELECT user_id FROM event_pair_members WHERE pair_id=$2)`, [reservation.event_id, reservation.target_pair_id]);
    await client.query("UPDATE events SET waiting_count=(SELECT count(*) FROM event_registrations WHERE event_id=$1 AND status='waiting' AND line_status='registered') WHERE id=$1", [reservation.event_id]);
  }
}

export async function stopPair(pairId: string, userId: string, report?: { reason: string; detail: string | null }) {
  await withLifecycleTransaction(async (client) => {
    const { rows: [pair] } = await client.query("SELECT * FROM event_pairs WHERE id=$1 FOR UPDATE", [pairId]);
    if (!pair || (pair.participant_a_id !== userId && pair.participant_b_id !== userId)) throw new LifecycleError("PAIR_NOT_FOUND", 404);
    const other = pair.participant_a_id === userId ? pair.participant_b_id : pair.participant_a_id;
    await client.query("INSERT INTO blocks (pair_id,blocker_user_id,blocked_user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [pairId, userId, other]);
    if (report) await client.query("INSERT INTO safety_reports (pair_id,reporter_user_id,reason,detail) VALUES ($1,$2,$3,$4)", [pairId, userId, report.reason, report.detail]);
    const { rows: related } = await client.query(`UPDATE event_pairs SET status='blocked',updated_at=now()
      WHERE (participant_a_id=$1 AND participant_b_id=$2) OR (participant_a_id=$2 AND participant_b_id=$1) RETURNING id`, [userId, other]);
    await cancelExtensions(client, related.map((row) => row.id));
  });
}

export async function cancelParticipation(eventId: string, userId: string) {
  return withLifecycleTransaction(async (client) => {
    const { rows: [event] } = await client.query("SELECT *,clock_timestamp() AS clock FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    if (!event || new Date(event.clock) >= new Date(event.starts_at)) throw new LifecycleError("REGISTRATION_CANCELLATION_CLOSED");
    if (event.kind === "extension") {
      const { rows: pairs } = await client.query("SELECT pair_id AS id FROM event_pair_members WHERE event_id=$1 AND user_id=$2", [eventId, userId]);
      await cancelExtensions(client, pairs.map((row) => row.id));
      return pairs.length > 0;
    }
    const { rows } = await client.query("UPDATE event_registrations SET status='cancelled',updated_at=now() WHERE event_id=$1 AND user_id=$2 AND status='waiting' RETURNING id", [eventId, userId]);
    await client.query("DELETE FROM event_pairs WHERE event_id=$1 AND (participant_a_id=$2 OR participant_b_id=$2)", [eventId, userId]);
    await client.query("UPDATE events SET waiting_count=(SELECT count(*) FROM event_registrations WHERE event_id=$1 AND status='waiting' AND line_status='registered') WHERE id=$1", [eventId]);
    return rows.length > 0;
  });
}

export async function deleteUserAccount(userId: string, email: string) {
  await withLifecycleTransaction(async (client) => {
    const { rows: memberships } = await client.query("SELECT pair_id AS id FROM event_pair_members WHERE user_id=$1", [userId]);
    await cancelExtensions(client, memberships.map((row) => row.id));
    await client.query(`WITH removed AS (DELETE FROM event_registrations WHERE user_id=$1 RETURNING event_id)
      UPDATE events e SET waiting_count=(SELECT count(*) FROM event_registrations r
        WHERE r.event_id=e.id AND r.user_id IS DISTINCT FROM $1::uuid AND r.status='waiting' AND r.line_status='registered')
      WHERE e.id IN (SELECT event_id FROM removed)`, [userId]);
    await client.query("DELETE FROM authentication_codes WHERE email=$1", [email]);
    await client.query("DELETE FROM users WHERE id=$1", [userId]);
  });
}

export async function closePairByAdmin(pairId: string, status: "closed" | "blocked") {
  await withLifecycleTransaction(async (client) => {
    await client.query("UPDATE event_pairs SET status=$2,updated_at=now() WHERE id=$1", [pairId, status]);
    await cancelExtensions(client, [pairId]);
  });
}
