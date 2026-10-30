import { scryptSync } from "node:crypto";
import type { Client } from "@neondatabase/serverless";
import { getDb, withLifecycleTransaction } from "../db";
import { createAuthSession } from "./auth";
import { safeSecretEqual } from "./crypto";
import { currentWeeklyEventSchedule } from "./event-schedule";
import { LifecycleError } from "./lifecycle";
import { normalizeSetlogInvite } from "./setlog-invite";

const REVIEW_EMAILS = ["review-a@set-mob.invalid", "review-b@set-mob.invalid"];
export const reviewScenarios = ["registration", "paired", "decision", "disclosed", "unmatched", "extension", "ended"] as const;

export function isReviewDeployment(request: Request) {
  if (process.env.APP_ENV !== "review" || !process.env.REVIEW_ENVIRONMENT_ID || !process.env.REVIEW_DATABASE_HOST || !process.env.REVIEW_API_ORIGIN) return false;
  try {
    const hostname = new URL(process.env.DATABASE_URL ?? "").hostname;
    return hostname === process.env.REVIEW_DATABASE_HOST && new URL(request.url).origin === new URL(process.env.REVIEW_API_ORIGIN).origin;
  } catch { return false; }
}

async function assertReviewDatabase(client: Client) {
  const { rows: [marker] } = await client.query("SELECT id FROM review_environment WHERE id=$1", [process.env.REVIEW_ENVIRONMENT_ID]);
  if (!marker) throw new LifecycleError("REVIEW_NOT_CONFIGURED", 503);
  const { rows: [others] } = await client.query("SELECT count(*)::int AS count FROM users WHERE email<>ALL($1::text[])", [REVIEW_EMAILS]);
  if (others.count) throw new LifecycleError("REVIEW_DATABASE_NOT_ISOLATED", 503);
}

async function reviewUsers(client: Client) {
  const people = [];
  for (let index = 0; index < REVIEW_EMAILS.length; index += 1) {
    const { rows: [user] } = await client.query(`INSERT INTO users (email,email_verified_at,line_user_id,line_followed,instagram_handle,line_contact)
      VALUES ($1,now(),$2,true,$3,'架空のLINE連絡先（送信不可）')
      ON CONFLICT (email) DO UPDATE SET line_followed=true RETURNING id,email`,
    [REVIEW_EMAILS[index], `set-mob-review-${index}`, `set_mob_demo_${index}`]);
    people.push(user);
  }
  return people;
}

export async function createReviewSession(username: unknown, password: unknown) {
  if (typeof username !== "string" || typeof password !== "string" || password.length > 200 || username.length > 80) throw new LifecycleError("REVIEW_LOGIN_INVALID", 401);
  if (!process.env.REVIEW_LOGIN_USERNAME || !process.env.REVIEW_PASSWORD_HASH || !process.env.AUTH_SECRET_PEPPER) throw new LifecycleError("REVIEW_NOT_CONFIGURED", 503);
  const valid = safeSecretEqual(username, process.env.REVIEW_LOGIN_USERNAME)
    && safeSecretEqual(scryptSync(password, process.env.AUTH_SECRET_PEPPER, 64).toString("hex"), process.env.REVIEW_PASSWORD_HASH);
  const user = await withLifecycleTransaction(async (client) => {
    await assertReviewDatabase(client);
    const { rows: [attempt] } = await client.query(`INSERT INTO review_login_attempts (id,attempts,window_start) VALUES (1,1,now())
      ON CONFLICT (id) DO UPDATE SET attempts=CASE WHEN review_login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE review_login_attempts.attempts+1 END,
      window_start=CASE WHEN review_login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE review_login_attempts.window_start END RETURNING attempts`);
    if (attempt.attempts > 10) return { error: "REVIEW_LOGIN_RATE_LIMITED" };
    if (!valid) return { error: "REVIEW_LOGIN_INVALID" };
    await client.query("UPDATE review_login_attempts SET attempts=0 WHERE id=1");
    return (await reviewUsers(client))[0];
  });
  if (user.error) throw new LifecycleError(user.error, user.error === "REVIEW_LOGIN_RATE_LIMITED" ? 429 : 401);
  const session = await createAuthSession(getDb(), user.id);
  return { authenticated: true, accessToken: session.rawToken, expiresAt: session.expiresAt.toISOString() };
}

export async function prepareReviewScenario(userId: string, scenario: unknown) {
  if (!reviewScenarios.includes(scenario as typeof reviewScenarios[number])) throw new LifecycleError("REVIEW_SCENARIO_INVALID", 400);
  await withLifecycleTransaction(async (client) => {
    await assertReviewDatabase(client);
    const people = await reviewUsers(client);
    if (people[0].id !== userId) throw new LifecycleError("REVIEW_ACCOUNT_REQUIRED", 403);
    const ids = people.map((person) => person.id);
    await client.query("DELETE FROM blocks WHERE blocker_user_id=ANY($1::uuid[]) OR blocked_user_id=ANY($1::uuid[])", [ids]);
    await client.query("DELETE FROM event_pairs WHERE participant_a_id=ANY($1::uuid[]) OR participant_b_id=ANY($1::uuid[])", [ids]);
    const { rows: removed } = await client.query("DELETE FROM event_registrations WHERE user_id=ANY($1::uuid[]) RETURNING event_id", [ids]);
    await client.query(`UPDATE events e SET waiting_count=(SELECT count(*) FROM event_registrations r
      WHERE r.event_id=e.id AND r.status='waiting' AND r.line_status='registered') WHERE e.id=ANY($1::uuid[])`, [removed.map((row) => row.event_id)]);
    const key = currentWeeklyEventSchedule().eventKey;
    const { rows: [event] } = await client.query(`INSERT INTO events (event_key,kind,starts_at) VALUES ($1,'weekly',now()+interval '1 hour')
      ON CONFLICT (event_key) DO UPDATE SET starts_at=excluded.starts_at,status='open',waiting_count=0 RETURNING id`, [key]);
    await client.query("DELETE FROM matching_runs WHERE event_id=$1", [event.id]);
    if (scenario === "registration") return;
    const elapsed = scenario === "decision" || scenario === "disclosed" || scenario === "extension" ? "10 hours 5 minutes" : scenario === "ended" ? "12 hours" : "1 hour";
    await client.query("UPDATE events SET starts_at=now()-$2::interval WHERE id=$1", [event.id, elapsed]);
    const peopleToRegister = scenario === "unmatched" ? people.slice(0, 1) : people;
    for (let index = 0; index < peopleToRegister.length; index += 1) {
      await client.query(`INSERT INTO event_registrations
        (event_id,user_id,session_id,status,line_status,nickname,faculty,academic_year,gender,purpose,preferred_gender,age_confirmed_at,rules_accepted_at)
        VALUES ($1,$2,gen_random_uuid(),'waiting','registered',$3,'架空の学部','2年','other','friend','any',now(),now())`, [event.id, peopleToRegister[index].id, `確認用${index === 0 ? "A" : "B"}（架空）`]);
    }
    await client.query("UPDATE events SET waiting_count=$2 WHERE id=$1", [event.id, peopleToRegister.length]);
    await client.query("INSERT INTO matching_runs (event_id,seed,eligible_count,paired_count) VALUES ($1,$2,$3,$4)", [event.id, key, peopleToRegister.length, scenario === "unmatched" ? 0 : 2]);
    if (scenario === "unmatched") return;
    const invite = normalizeSetlogInvite(process.env.REVIEW_SETLOG_INVITE);
    const { rows: [pair] } = await client.query(`INSERT INTO event_pairs
      (event_id,participant_a_id,participant_b_id,status,published_at,setlog_url,setlog_code,invite_submitted_by)
      VALUES ($1,$2,$3,'published',now(),$4,$5,$6) RETURNING id`, [event.id, ids[0], ids[1], invite?.url ?? null, invite?.code ?? null, invite ? ids[0] : null]);
    if (scenario === "decision" || scenario === "disclosed") {
      for (const id of scenario === "disclosed" ? ids : ids.slice(1)) await client.query(`INSERT INTO pair_decisions
        (pair_id,user_id,instagram,line,continue_choice,none,answered,answered_at) VALUES ($1,$2,true,false,false,false,true,now())`, [pair.id, id]);
      if (scenario === "disclosed") await client.query("UPDATE event_pairs SET finalized_at=now() WHERE id=$1", [pair.id]);
    }
    if (scenario === "extension") {
      const sundayKey = `sun-${new Date(currentWeeklyEventSchedule().startsAt.getTime() + 86400_000 + 9 * 3600_000).toISOString().slice(0, 10)}`;
      const { rows: [sunday] } = await client.query(`INSERT INTO events (event_key,kind,starts_at,waiting_count) VALUES ($1,'extension',now()-interval '10 hours 5 minutes',2)
        ON CONFLICT (event_key) DO UPDATE SET starts_at=excluded.starts_at,waiting_count=2 RETURNING id`, [sundayKey]);
      await client.query(`INSERT INTO event_registrations (event_id,user_id,session_id,status,line_status,nickname,faculty,academic_year,gender,purpose,preferred_gender,age_confirmed_at,rules_accepted_at)
        SELECT $1,user_id,gen_random_uuid(),status,line_status,nickname,faculty,academic_year,gender,purpose,preferred_gender,age_confirmed_at,rules_accepted_at FROM event_registrations WHERE event_id=$2`, [sunday.id, event.id]);
      const { rows: [target] } = await client.query(`INSERT INTO event_pairs (event_id,participant_a_id,participant_b_id,status,published_at,setlog_url,setlog_code,invite_submitted_by)
        VALUES ($1,$2,$3,'published',now(),$4,$5,$6) RETURNING id`, [sunday.id, ids[0], ids[1], invite?.url ?? null, invite?.code ?? null, invite ? ids[0] : null]);
      await client.query("INSERT INTO pair_extensions (source_pair_id,target_pair_id,event_id) VALUES ($1,$2,$3)", [pair.id, target.id, sunday.id]);
      await client.query(`INSERT INTO pair_decisions (pair_id,user_id,instagram,line,continue_choice,none,answered,answered_at)
        VALUES ($1,$2,true,false,false,false,true,now())`, [target.id, ids[1]]);
    }
  });
}
