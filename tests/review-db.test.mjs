import assert from "node:assert/strict";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import test, { before } from "node:test";
import { neon } from "@neondatabase/serverless";

if (!process.env.TEST_DATABASE_URL || new URL(process.env.TEST_DATABASE_URL).pathname !== "/set_mob_review"
  || process.env.DB_TEST_BRANCH_ID !== "br-frosty-dew-ax7g2of8") throw new Error("The isolated review database is required.");
const password = randomBytes(32).toString("base64url");
const marker = randomUUID();
Object.assign(process.env, {
  DATABASE_URL: process.env.TEST_DATABASE_URL, APP_ENV: "review", AUTO_MATCHING_ENABLED: "true",
  REVIEW_DATABASE_HOST: new URL(process.env.TEST_DATABASE_URL).hostname,
  REVIEW_API_ORIGIN: "https://review.set-mob.invalid", REVIEW_ENVIRONMENT_ID: marker,
  REVIEW_LOGIN_USERNAME: "isolated-test-reviewer", AUTH_SECRET_PEPPER: randomBytes(32).toString("hex"),
  AUTH_EMAIL_EXCEPTIONS: "review-a@set-mob.invalid,review-b@set-mob.invalid", CRON_SECRET: randomBytes(32).toString("hex"),
  RESEND_API_KEY: "", LINE_MESSAGING_ACCESS_TOKEN: "",
});
process.env.REVIEW_PASSWORD_HASH = scryptSync(password, process.env.AUTH_SECRET_PEPPER, 64).toString("hex");
const sql = neon(process.env.DATABASE_URL);
let worker, token;
const origin = process.env.REVIEW_API_ORIGIN;

async function api(path, method = "GET", body, requestOrigin = origin) {
  worker ??= (await import("../dist/server/index.js?review-test")).default;
  const response = await worker.fetch(new Request(`${requestOrigin}${path}`, { method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  return { status: response.status, body: await response.json().catch(() => null) };
}

before(async () => {
  const [others] = await sql`SELECT count(*)::int AS count FROM users WHERE email NOT IN ('review-a@set-mob.invalid','review-b@set-mob.invalid')`;
  assert.equal(others.count, 0, "The review database must contain synthetic accounts only.");
  await sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS review_environment (id uuid PRIMARY KEY)`,
    sql`CREATE TABLE IF NOT EXISTS review_login_attempts (id integer PRIMARY KEY,attempts integer NOT NULL,window_start timestamptz NOT NULL)`,
  ]);
  await sql`INSERT INTO review_environment (id) VALUES (${marker}::uuid)`;
  await sql`DELETE FROM review_login_attempts`;
});

test("review login requires credentials and the configured origin; regular email login is disabled", async () => {
  assert.equal((await api("/api/mobile/review/session", "POST", { username: "wrong", password })).status, 401);
  assert.equal((await api("/api/mobile/review/session", "POST", { username: process.env.REVIEW_LOGIN_USERNAME, password }, "https://wrong.set-mob.invalid")).status, 404);
  assert.equal((await api("/api/auth/request-code", "POST", { email: "student@aoyama.jp" })).status, 404);
  assert.equal((await api("/api/mobile/auth/verify-code", "POST", { email: "student@aoyama.jp", code: "000000" })).status, 404);
  const login = await api("/api/mobile/review/session", "POST", { username: process.env.REVIEW_LOGIN_USERNAME, password });
  assert.equal(login.status, 200, JSON.stringify(login.body)); token = login.body.accessToken;
  assert.ok(token);
  const me = (await api("/api/mobile/me")).body.user;
  assert.equal(me.email, "review-a@set-mob.invalid");
  assert.deepEqual((await api("/api/me/participation")).body.contacts, { instagramHandle: me.instagramHandle, lineContact: me.lineContact });
});

test("all review scenarios restore through the normal participation API", async () => {
  for (const scenario of ["registration", "paired", "decision", "disclosed", "unmatched", "extension", "ended"]) {
    const prepared = await api("/api/mobile/review/scenario", "POST", { scenario });
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    const current = await api("/api/me/participation");
    assert.equal(current.status, 200, JSON.stringify(current.body));
    const { event, pair } = current.body;
    if (scenario === "registration") assert.equal(event.registration, null);
    if (scenario === "unmatched") { assert.equal(event.matchingStatus, "unmatched"); assert.equal(pair, null); }
    if (scenario === "paired") { assert.equal(pair.invite.status, "waiting"); assert.equal(pair.setlogCode, null); }
    if (scenario === "decision") {
      assert.equal(pair.decisionOpen, true); assert.equal(pair.partnerAnswered, true);
      const result = await api(`/api/pairs/${pair.id}/decision`, "POST", { instagram: true });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.result.kind, "disclosed");
    }
    if (scenario === "disclosed") assert.equal(pair.result.contacts.instagram, "set_mob_demo_1");
    if (scenario === "extension") {
      assert.equal(pair.kind, "extension");
      assert.equal((await api(`/api/pairs/${pair.id}/decision`, "POST", { continue: true })).body.error, "EXTENSION_LIMIT_REACHED");
    }
    if (scenario === "ended") { assert.equal(pair.result.kind, "ended"); assert.equal(pair.decisionOpen, false); }
  }
  const [analytics] = await sql`SELECT count(*)::int AS count FROM funnel_events`;
  assert.equal(analytics.count, 0);
});

test("review APIs fail closed when environment or database marker changes", async () => {
  process.env.APP_ENV = "production";
  assert.equal((await api("/api/mobile/review/scenario", "POST", { scenario: "paired" })).status, 404);
  process.env.APP_ENV = "review";
  process.env.REVIEW_ENVIRONMENT_ID = randomUUID();
  assert.equal((await api("/api/mobile/review/scenario", "POST", { scenario: "paired" })).body.error, "REVIEW_NOT_CONFIGURED");
  process.env.REVIEW_ENVIRONMENT_ID = marker;
});

test("next registration persists on the server and restores after an unmatched event", async () => {
  assert.equal((await api("/api/mobile/review/scenario", "POST", { scenario: "unmatched" })).status, 200);
  const current = (await api("/api/me/participation")).body;
  const next = (await api("/api/me/participation?next=true")).body;
  assert.notEqual(next.event.eventKey, current.event.eventKey);
  assert.equal(next.event.registrationOpen, true);
  const input = { profile: { nickname: "確認用A", faculty: "架空学部", academicYear: "2年", gender: "other" },
    preferences: { purpose: "friend", preferredGender: "any" }, contacts: { instagramHandle: "set_mob_demo_0", lineContact: null }, ageConfirmed: true, rulesAccepted: true };
  const saved = await api(`/api/events/${next.event.eventKey}/registrations`, "POST", input);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const restored = await api("/api/me/participation");
  assert.equal(restored.body.event.eventKey, next.event.eventKey);
  assert.equal(restored.body.event.registration.status, "waiting");
  assert.equal((await api("/api/mobile/review/scenario", "POST", { scenario: "unmatched" })).status, 200);
  const [reset] = await sql`SELECT waiting_count FROM events WHERE event_key=${next.event.eventKey}`;
  assert.equal(reset.waiting_count, 0, "Resetting a review scenario must not consume future capacity.");
});
