import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("participant APIs accept Bearer without changing admin authentication", async () => {
  const [auth, participant, admin, mobileVerify, webVerify, signOut, mobileMe] = await Promise.all([
    source("../lib/auth.ts"),
    source("../app/api/events/[eventKey]/pair/route.ts"),
    source("../app/api/admin/reports/route.ts"),
    source("../app/api/mobile/auth/verify-code/route.ts"),
    source("../app/api/auth/verify-code/route.ts"),
    source("../app/api/mobile/auth/sign-out/route.ts"),
    source("../app/api/mobile/me/route.ts"),
  ]);

  assert.match(auth, /\^Bearer \(\[A-Za-z0-9_-\]\+\)\$/);
  assert.match(auth, /gt\(authSessions\.expiresAt, new Date\(\)\)/);
  assert.match(auth, /if \(request\.headers\.has\("authorization"\)\)/);
  assert.match(auth, /return getCurrentAuthUser\(\)/);
  assert.match(participant, /getApiAuthUser\(request\)/);
  assert.match(admin, /getCurrentAuthUser\(\)/);
  assert.doesNotMatch(admin, /getApiAuthUser/);
  assert.match(mobileVerify, /accessToken: result\.session\.rawToken/);
  assert.doesNotMatch(mobileVerify, /setAuthCookie/);
  assert.match(webVerify, /setAuthCookie/);
  assert.match(signOut, /revokeAuthToken/);
  assert.match(mobileMe, /instagramHandle/);
  assert.match(mobileMe, /lineContact/);
});

test("mobile LINE state is hashed, expiring, and one-time", async () => {
  const [schema, migration, login, callback] = await Promise.all([
    source("../db/schema.ts"),
    source("../drizzle/0005_big_songbird.sql"),
    source("../app/api/mobile/line/login/route.ts"),
    source("../app/api/line/callback/route.ts"),
  ]);

  assert.match(schema, /lineLoginStates/);
  assert.match(schema, /stateHash/);
  assert.match(migration, /CREATE TABLE "line_login_states"/);
  assert.match(login, /10 \* 60 \* 1000/);
  assert.match(login, /stateHash: hashSecret\(state\)/);
  assert.match(login, /setmob:\/\/line-callback/);
  assert.match(callback, /isNull\(lineLoginStates\.consumedAt\)/);
  assert.match(callback, /gt\(lineLoginStates\.expiresAt, now\)/);
  assert.match(callback, /consumedAt: now/);
  assert.match(callback, /linked-not-following/);
  assert.match(callback, /already-linked/);
});

test("failed verification email does not leave a throttling code behind", async () => {
  const [route, email] = await Promise.all([
    source("../app/api/auth/request-code/route.ts"),
    source("../lib/email.ts"),
  ]);

  assert.match(route, /returning\(\{ id: authenticationCodes\.id \}\)/);
  assert.match(route, /delete\(authenticationCodes\).*created\.id/s);
  assert.match(route, /verification email rejected/);
  assert.match(email, /class EmailDeliveryError/);
  assert.match(email, /payload\?\.message/);
});

test("registration GET restores the participant state", async () => {
  const registration = await source("../app/api/events/[eventKey]/registrations/route.ts");
  assert.match(registration, /export async function GET/);
  assert.match(registration, /registration: registration \?/);
  assert.match(registration, /ageConfirmed/);
  assert.match(registration, /rulesAccepted/);
  assert.match(registration, /remaining: Math\.max/);
});

test("weekly events expose cancellation and enforce the private decision window", async () => {
  const [schedule, registration, pair, decision, eventMigration, registrationMigration, cron] = await Promise.all([
    source("../lib/event-schedule.ts"),
    source("../app/api/events/[eventKey]/registrations/route.ts"),
    source("../lib/pair.ts"),
    source("../app/api/pairs/[pairId]/decision/route.ts"),
    source("../drizzle/0006_weekly_event_controls.sql"),
    source("../drizzle/0007_fast_praxagora.sql"),
    source("../app/api/cron/line-reminder/route.ts"),
  ]);

  assert.match(schedule, /sat-\$\{year\}-/);
  assert.match(schedule, /DECISION_DELAY_MS = 10 \* 60 \* 60 \* 1000/);
  assert.match(registration, /export async function DELETE/);
  assert.match(registration, /REGISTRATION_CANCELLATION_CLOSED/);
  assert.match(registration, /EVENT_REGISTRATION_CLOSED/);
  assert.match(pair, /decisionOpen/);
  assert.match(decision, /DECISION_NOT_OPEN/);
  assert.match(eventMigration, /WHERE "event_key" = 'next-saturday'/);
  assert.match(registrationMigration, /existing_id IS NOT NULL/);
  assert.match(registrationMigration, /"status" = ''waiting''/);
  assert.doesNotMatch(cron, /event_key = 'next-saturday'/);
  assert.match(cron, /e\.starts_at <= now\(\) \+ interval '18 hours'/);
});

test("attribution, mutual preferences, and report workflow are server enforced", async () => {
  const [schema, analytics, visit, registration, createPair, updatePair, metrics, reportStatus] = await Promise.all([
    source("../db/schema.ts"),
    source("../lib/analytics.ts"),
    source("../app/api/analytics/visit/route.ts"),
    source("../app/api/events/[eventKey]/registrations/route.ts"),
    source("../app/api/admin/events/[eventKey]/pairs/route.ts"),
    source("../app/api/admin/pairs/[pairId]/route.ts"),
    source("../app/api/admin/metrics/route.ts"),
    source("../app/api/admin/reports/[reportId]/route.ts"),
  ]);
  assert.match(schema, /funnelEvents/);
  assert.match(schema, /preferredGender/);
  assert.match(analytics, /HttpOnly/);
  assert.match(visit, /qualified_visit/);
  assert.match(registration, /PREFERENCES_REQUIRED/);
  assert.match(createPair, /PAIR_PREFERENCES_MISMATCH/);
  assert.match(updatePair, /PAIR_PREFERENCES_MISMATCH/);
  assert.match(metrics, /registrationsCompleted/);
  assert.match(reportStatus, /reviewedAt/);
  assert.match(reportStatus, /resolvedAt/);
});

test("block and report stay participant-authenticated safety actions", async () => {
  const [blockRoute, reportRoute] = await Promise.all([
    source("../app/api/pairs/[pairId]/block/route.ts"),
    source("../app/api/pairs/[pairId]/report/route.ts"),
  ]);
  assert.match(blockRoute, /getApiAuthUser\(request\)/);
  assert.match(blockRoute, /blockedUserId/);
  assert.match(reportRoute, /getApiAuthUser\(request\)/);
  assert.match(reportRoute, /safetyReports/);
  assert.match(reportRoute, /REPORT_REASON_REQUIRED/);
});
