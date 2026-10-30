import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { Client, neon } from "@neondatabase/serverless";

if (!process.env.TEST_DATABASE_URL || !/^br-/.test(process.env.DB_TEST_BRANCH_ID ?? "") || process.env.DB_TEST_BRANCH_ID === "br-divine-flower-axs271rq") throw new Error("An explicitly isolated database is required.");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET_PEPPER = `lifecycle-test-${randomBytes(16).toString("hex")}`;
process.env.AUTO_MATCHING_ENABLED = "true";
process.env.APP_ENV = "test";
process.env.LINE_MESSAGING_ACCESS_TOKEN = "";
process.env.RESEND_API_KEY = "";
const sql = neon(process.env.TEST_DATABASE_URL);
const runId = randomBytes(5).toString("hex");
const people = [];
const eventKeys = [];
let pair;
let continuationPair;
let extension;
let worker;
const yesInstagram = { instagram: true, line: false, continue: false, none: false };
const yesContinue = { instagram: false, line: false, continue: true, none: false };
const nothing = { instagram: false, line: false, continue: false, none: true };

async function api(path, user, method = "GET", body) {
  worker ??= (await import(`../dist/server/index.js?lifecycle=${runId}`)).default;
  const response = await worker.fetch(new Request(`http://localhost${path}`, {
    method, headers: { accept: "application/json", "content-type": "application/json", ...(user ? { authorization: `Bearer ${user.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function person(index) {
  const token = randomBytes(32).toString("base64url");
  const [user] = await sql`INSERT INTO users (email,email_verified_at,line_user_id,line_followed,instagram_handle,line_contact)
    VALUES (${`test-${runId}-${index}@aoyama.jp`},now(),${`test-${runId}-${index}`},true,${`test_${runId}_${index}`},${`line-${index}`}) RETURNING id,email,instagram_handle`;
  const hash = createHash("sha256").update(`${process.env.AUTH_SECRET_PEPPER}:${token}`).digest("hex");
  const [session] = await sql`INSERT INTO auth_sessions (user_id,token_hash,expires_at) VALUES (${user.id},${hash},now()+interval '1 hour') RETURNING id`;
  const result = { ...user, token, sessionId: session.id }; people.push(result); return result;
}

async function event(key, elapsed = "1 hour") {
  eventKeys.push(key);
  const [row] = await sql`INSERT INTO events (event_key,starts_at) VALUES (${key},now()-${elapsed}::interval) RETURNING id,event_key`;
  return row;
}

async function register(event, user, gender, purpose, preferred = "any", consent = true) {
  await sql`INSERT INTO event_registrations
    (event_id,user_id,session_id,status,line_status,nickname,faculty,academic_year,gender,purpose,preferred_gender,age_confirmed_at,rules_accepted_at)
    VALUES (${event.id},${user.id},${user.sessionId},'waiting','registered',${`確認-${runId}`},'テスト学部','2年',${gender},${purpose}::match_purpose,${preferred}::gender_preference,${consent ? new Date() : null},${consent ? new Date() : null})`;
}

after(async () => {
  for (const user of people) await sql`DELETE FROM users WHERE id=${user.id}`;
  for (const key of eventKeys) await sql`DELETE FROM events WHERE event_key=${key}`;
});

test("new participant routes require authentication and review login is absent in production mode", async () => {
  assert.equal((await api("/api/me/participation")).status, 401);
  assert.equal((await api(`/${"api/pairs"}/${randomUUID()}/setlog-invite`, null, "PUT", { invite: "abc1234" })).status, 401);
  assert.equal((await api("/api/mobile/review/session", null, "POST", {})).status, 404);
});

test("parallel automatic matching creates one complete run, excludes missing consent, and leaves an unmatched user", async () => {
  for (let index = 0; index < 6; index += 1) await person(index);
  const current = await event(`sat-1900-01-06`);
  await register(current, people[0], "male", "friend", "female");
  await register(current, people[1], "female", "friend");
  await register(current, people[2], "female", "romance", "male");
  await register(current, people[3], "male", "romance", "female");
  await register(current, people[4], "other", "friend", "other");
  await register(current, people[5], "other", "friend", "other", false);
  const responses = await Promise.all(Array.from({ length: 6 }, () => api(`/api/events/${current.event_key}/pair`, people[0])));
  for (const response of responses) assert.ok(response.status === 200 || response.status === 404, JSON.stringify(response));
  pair = (await api(`/api/events/${current.event_key}/pair`, people[0])).body.pair;
  continuationPair = (await api(`/api/events/${current.event_key}/pair`, people[2])).body.pair;
  assert.equal(pair.candidate.id, people[1].id);
  assert.equal(continuationPair.candidate.id, people[3].id);
  assert.equal(pair.setlogCode, null);
  const [run] = await sql`SELECT * FROM matching_runs WHERE event_id=${current.id}`;
  assert.equal(run.eligible_count, 5); assert.equal(run.paired_count, 4);
  const [count] = await sql`SELECT count(*)::int AS count FROM event_pair_members WHERE event_id=${current.id}`;
  assert.equal(count.count, 4);
  assert.equal((await api(`/api/events/${current.event_key}/pair`, people[4])).status, 404);
});

test("only pair participants can share one invite and confirmation prevents correction", async () => {
  const path = `/api/pairs/${pair.id}/setlog-invite`;
  assert.equal((await api(path, people[4], "PUT", { invite: "abc1234" })).status, 404);
  assert.equal((await api(path, people[0], "PUT", { invite: "https://evil.example/invite/abc" })).status, 400);
  assert.equal((await api(path, people[0], "PUT", { invite: "abc1234" })).status, 200);
  assert.equal((await api(path, people[1], "PUT", { invite: "different" })).status, 409);
  assert.equal((await api(path, people[0], "PUT", { invite: "corrected" })).status, 200);
  assert.equal((await api(path, people[1], "POST")).status, 200);
  assert.equal((await api(path, people[0], "PUT", { invite: "afterjoin" })).status, 409);
  const current = await api(`/api/pairs/${pair.id}`, people[1]);
  assert.equal(current.body.pair.setlogCode, "corrected");
  assert.equal(current.body.pair.invite.joined, true);
});

test("results disclose immediately on mutual answers and finalized answers cannot be changed", async () => {
  await sql`UPDATE events SET starts_at=now()-interval '10 hours 5 minutes' WHERE event_key='sat-1900-01-06'`;
  const first = await api(`/api/pairs/${pair.id}/decision`, people[0], "POST", yesInstagram);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.result.kind, "pending"); assert.equal(first.body.result.contacts, null);
  const second = await api(`/api/pairs/${pair.id}/decision`, people[1], "POST", yesInstagram);
  assert.equal(second.status, 200, JSON.stringify(second.body)); assert.equal(second.body.result.kind, "disclosed");
  assert.equal(second.body.result.contacts.instagram, people[0].instagram_handle);
  assert.equal((await api(`/api/pairs/${pair.id}/decision`, people[1], "POST", yesInstagram)).status, 200);
  assert.equal((await api(`/api/pairs/${pair.id}/decision`, people[0], "POST", nothing)).status, 409);
});

test("two continuation requests atomically reserve Sunday once and either person can cancel", async () => {
  const path = `/api/pairs/${continuationPair.id}/decision`;
  const responses = await Promise.all([api(path, people[2], "POST", yesContinue), api(path, people[3], "POST", yesContinue)]);
  for (const response of responses) assert.equal(response.status, 200, JSON.stringify(response.body));
  const current = await api(`/api/pairs/${continuationPair.id}`, people[2]);
  assert.equal(current.body.pair.result.kind, "continued"); assert.equal(current.body.pair.result.contacts, null);
  extension = current.body.pair.extension; eventKeys.push(extension.eventKey);
  assert.equal(extension.eventKey, "sun-1900-01-07");
  const reservations = await sql`SELECT * FROM pair_extensions WHERE source_pair_id=${continuationPair.id}`;
  assert.equal(reservations.length, 1);
  const before = await api(`/api/events/${extension.eventKey}/pair`, people[2]);
  assert.equal(before.status, 404);
  const cancelled = await api(`/api/events/${extension.eventKey}/registrations`, people[3], "DELETE");
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  const [reservation] = await sql`SELECT status FROM pair_extensions WHERE source_pair_id=${continuationPair.id}`;
  assert.equal(reservation.status, "cancelled");
  const [waiting] = await sql`SELECT count(*)::int AS count FROM event_registrations r JOIN events e ON e.id=r.event_id WHERE e.event_key=${extension.eventKey} AND r.status='waiting'`;
  assert.equal(waiting.count, 0);
});

test("Sunday cannot extend again and blocking removes invitations and prevents future pairing", async () => {
  const source = await event("sat-1900-01-13", "10 hours 5 minutes");
  await register(source, people[4], "other", "friend");
  await register(source, people[5], "other", "friend");
  const [created] = await sql`INSERT INTO event_pairs (event_id,participant_a_id,participant_b_id,status,published_at)
    VALUES (${source.id},${people[4].id},${people[5].id},'published',now()) RETURNING id`;
  await api(`/api/pairs/${created.id}/decision`, people[4], "POST", yesContinue);
  const agreed = await api(`/api/pairs/${created.id}/decision`, people[5], "POST", yesContinue);
  assert.equal(agreed.status, 200, JSON.stringify(agreed.body));
  const sunday = agreed.body.pair.extension; eventKeys.push(sunday.eventKey);
  await sql`UPDATE events SET starts_at=now()-interval '10 hours 5 minutes' WHERE event_key=${sunday.eventKey}`;
  const child = await api(`/api/events/${sunday.eventKey}/pair`, people[4]);
  assert.equal(child.status, 200, JSON.stringify(child.body));
  assert.equal((await api(`/api/pairs/${child.body.pair.id}/decision`, people[4], "POST", yesContinue)).body.error, "EXTENSION_LIMIT_REACHED");
  assert.equal((await api(`/api/pairs/${child.body.pair.id}/block`, people[4], "POST")).status, 200);
  assert.equal((await api(`/api/pairs/${created.id}`, people[5])).status, 404);
  assert.equal((await api(`/api/pairs/${child.body.pair.id}`, people[5])).status, 404);
  const next = await event("sat-1900-01-20");
  await register(next, people[4], "other", "friend"); await register(next, people[5], "other", "friend");
  assert.equal((await api(`/api/events/${next.event_key}/pair`, people[4])).status, 404);
});

test("23:00 closes incomplete decisions and deleting an account invalidates its session", async () => {
  await sql`UPDATE events SET starts_at=now()-interval '12 hours' WHERE event_key='sat-1900-01-06'`;
  assert.equal((await api(`/api/pairs/${pair.id}/decision`, people[0], "POST", yesInstagram)).body.error, "DECISION_CLOSED");
  const deleted = await api("/api/me", people[0], "DELETE");
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.equal((await api("/api/mobile/me", people[0])).status, 401);
});

test("registration is atomic at capacity, restores profiles, and refuses writes after the cutoff", async () => {
  const a = await person(6), b = await person(7);
  const upcoming = await event("sat-1900-01-27", "-1 hour");
  await sql`UPDATE events SET capacity=1 WHERE id=${upcoming.id}`;
  const input = { profile: { nickname: "確認用", faculty: "テスト学部", academicYear: "2年", gender: "other" },
    preferences: { purpose: "friend", preferredGender: "any" }, contacts: { instagramHandle: "test_registered", lineContact: null }, ageConfirmed: true, rulesAccepted: true };
  const path = `/api/events/${upcoming.event_key}/registrations`;
  assert.equal((await api(path, a, "POST", { ...input, rulesAccepted: false })).status, 400);
  const answers = await Promise.all([api(path, a, "POST", input), api(path, b, "POST", input)]);
  assert.deepEqual(answers.map((answer) => answer.status).sort(), [200, 409]);
  const winner = answers[0].status === 200 ? a : b, other = winner === a ? b : a;
  assert.equal((await api(path, winner, "POST", input)).status, 200);
  const snapshot = await api(path, winner);
  assert.equal(snapshot.status, 200, JSON.stringify(snapshot.body));
  assert.equal(snapshot.body.count, 1); assert.equal(snapshot.body.registration.nickname, "確認用");
  assert.equal(snapshot.body.registration.ageConfirmed, true);
  assert.equal((await api(path, winner, "DELETE")).status, 200);
  assert.equal((await api(path, other, "POST", input)).status, 200);
  await sql`UPDATE events SET starts_at=now()-interval '1 minute' WHERE id=${upcoming.id}`;
  assert.equal((await api(path, other, "POST", input)).body.error, "EVENT_REGISTRATION_CLOSED");
  assert.equal((await api(path, other, "DELETE")).body.error, "REGISTRATION_CANCELLATION_CLOSED");
  const state = await api("/api/me/participation", other);
  assert.equal(state.status, 200, JSON.stringify(state.body));
  assert.equal(state.body.event.previousRegistration.nickname, "確認用");
  const [count] = await sql`SELECT waiting_count FROM events WHERE id=${upcoming.id}`;
  assert.equal(count.waiting_count, 1);
});

test("registration rechecks the live deadline after waiting for another transaction", async () => {
  const user = await person(8);
  const upcoming = await event("sat-1900-02-03", "-1 hour");
  const client = new Client(process.env.TEST_DATABASE_URL);
  client.neonConfig.webSocketConstructor = globalThis.WebSocket;
  await client.connect();
  let pending;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73241901)");
    await client.query("UPDATE events SET starts_at=clock_timestamp()+interval '3 seconds' WHERE id=$1", [upcoming.id]);
    pending = api(`/api/events/${upcoming.event_key}/registrations`, user, "POST", {
      profile: { nickname: "締切確認", faculty: "テスト学部", academicYear: "2年", gender: "other" },
      preferences: { purpose: "friend", preferredGender: "any" }, contacts: {}, ageConfirmed: true, rulesAccepted: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 5500));
    await client.query("COMMIT");
    const response = await pending;
    assert.equal(response.status, 409, JSON.stringify(response.body));
    assert.equal(response.body.error, "EVENT_REGISTRATION_CLOSED");
    const [count] = await sql`SELECT count(*)::int AS count FROM event_registrations WHERE event_id=${upcoming.id}`;
    assert.equal(count.count, 0);
  } finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); }
});
