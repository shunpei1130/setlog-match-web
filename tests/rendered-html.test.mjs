import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", init = {}, host = "localhost") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://${host}${path}`, { headers: { accept: "text/html", ...init.headers }, ...init }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the set-mob MVP", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>set-mob \| 青学生限定の土曜マッチング<\/title>/i);
  assert.match(html, /土曜日を準備しています/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("publishes terms, privacy, safety, contact, and a protected deletion endpoint", async () => {
  const pages = await Promise.all(["/terms", "/privacy", "/safety", "/contact"].map((path) => render(path)));
  for (const response of pages) assert.equal(response.status, 200);
  assert.match(await pages[0].text(), /利用規約/);
  assert.match(await pages[1].text(), /プライバシーポリシー/);
  assert.match(await pages[2].text(), /安全ガイド/);
  assert.match(await pages[3].text(), /アカウントと登録データを削除/);

  const deletion = await render("/api/me", { method: "DELETE" });
  assert.equal(deletion.status, 401);
  assert.deepEqual(await deletion.json(), { error: "AUTH_REQUIRED" });
});

test("does not report zero when the waiting-count database is unavailable", async () => {
  const response = await render("/api/events/next-saturday/waiting-count");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "WAITING_COUNT_UNAVAILABLE" });
});

test("requires an authenticated Aoyama account for registration", async () => {
  const response = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lineRegistered: true,
      schoolEmail: "student@aoyama.jp",
      ageConfirmed: true,
      rulesAccepted: true,
      profile: validProfile(),
      preferences: validPreferences(),
    }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "AUTH_REQUIRED" });
});

test("rejects non-Aoyama email before sending an auth code", async () => {
  const response = await render("/api/auth/request-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "student@example.com" }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "AOYAMA_EMAIL_REQUIRED" });
});

test("allows only the configured operator email as an auth exception", async () => {
  const previous = process.env.AUTH_EMAIL_EXCEPTIONS;
  process.env.AUTH_EMAIL_EXCEPTIONS = "s.hasegawa1130@gmail.com";
  try {
    const operatorResponse = await render("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: " S.HASEGAWA1130@GMAIL.COM " }),
    });
    assert.equal(operatorResponse.status, 503);
    assert.deepEqual(await operatorResponse.json(), { error: "AUTH_CODE_UNAVAILABLE" });

    for (const email of ["s.hasegawa1130@outlook.com", "other@gmail.com"]) {
      const response = await render("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "AOYAMA_EMAIL_REQUIRED" });
    }
  } finally {
    if (previous === undefined) delete process.env.AUTH_EMAIL_EXCEPTIONS;
    else process.env.AUTH_EMAIL_EXCEPTIONS = previous;
  }
});

test("accepts the LINE bypass only on localhost", async () => {
  const body = JSON.stringify({ lineTestBypass: true, schoolEmailTestBypass: true, profile: validProfile(), preferences: validPreferences() });
  const localResponse = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  assert.equal(localResponse.status, 503);

  const productionResponse = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }, "set-mob.example");
  assert.equal(productionResponse.status, 400);
  assert.deepEqual(await productionResponse.json(), { error: "LOCAL_TEST_BYPASS_NOT_ALLOWED" });
});

test("requires the four profile fields before registration", async () => {
  const response = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schoolEmail: "student@aoyama.jp", lineRegistered: true }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "PROFILE_REQUIRED",
    fields: ["nickname", "faculty", "academicYear", "gender"],
  });
});

test("rejects invalid profile values", async () => {
  const response = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schoolEmail: "student@aoyama.jp",
      lineRegistered: true,
      profile: { ...validProfile(), gender: "unknown" },
    }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "PROFILE_INVALID", fields: ["gender"] });
});

function validProfile() {
  return { nickname: "ゆうき", faculty: "経済学部", academicYear: "2年", gender: "male" };
}

function validPreferences() {
  return { purpose: "either", preferredGender: "any" };
}

test("keeps the MVP free of starter preview artifacts", async () => {
  const [page, layout, packageJson, schema, db, eventRegistration, waitingRoute, registrationRoute, session, schoolEmail, authEmail, localTest, envExample, iosAuthScreen, migration, profileMigration, fullMigration, authRoute, authVerification, lineRoute, pairRoute, adminPage, cronRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/event-registration.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/[eventKey]/waiting-count/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/[eventKey]/registrations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/school-email.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth-email.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/local-test.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../ios/src/components/auth-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_military_the_stranger.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_fixed_zeigeist.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_open_ultimatum.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/verify-code/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth-verification.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/line/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pairs/[pairId]/decision/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/line-reminder/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /localStorage/);
  assert.match(page, /profile-nickname/);
  assert.match(page, /profile-faculty/);
  assert.match(page, /profile-year/);
  assert.match(page, /profile-gender/);
  assert.match(page, /profile-instagram/);
  assert.match(page, /profile-line-contact/);
  assert.match(page, /auth-code/);
  assert.match(page, /PROFILE_REQUIRED/);
  assert.match(page, /SetlogAdapter/);
  assert.match(page, /青学の知らない人の一日/);
  assert.match(page, /次の土曜に事前登録する/);
  assert.match(page, /100人限定/);
  assert.match(page, /残り枠を取得できません/);
  assert.match(page, /lineTestBypass/);
  assert.match(page, /local_test/);
  assert.match(page, /金曜21:00/);
  assert.match(page, /waiting/);
  assert.match(page, /土曜のマッチングを開始する/);
  assert.match(page, /matchingStarted/);
  assert.match(page, /lineRegistration/);
  assert.match(page, /scheduleReminder/);
  assert.match(page, /LINE登録を完了する/);
  assert.match(page, /明日はマッチング！/);
  assert.match(page, /set-mob-state-v1/);
  assert.match(page, /setlog-match-mvp-state-v4/);
  assert.match(page, /line-modal/);
  assert.match(page, /schoolEmail/);
  assert.match(page, /normalizeEmailAddress/);
  assert.doesNotMatch(page, /isAoyamaStudentEmail/);
  assert.match(page, /waitingCount/);
  assert.match(page, /waiting-count/);
  assert.match(page, /registrations/);
  assert.doesNotMatch(page, /髱貞|繧峨|縺/);
  assert.match(schema, /capacity/);
  assert.match(schema, /waitingCount/);
  assert.match(schema, /eventRegistrations/);
  assert.match(schema, /academicYear/);
  assert.match(schema, /gender/);
  assert.match(schema, /event_registrations_event_session_idx/);
  assert.match(db, /DATABASE_URL/);
  assert.match(db, /neon-http/);
  assert.match(eventRegistration, /INITIAL_EVENT_CAPACITY = 100/);
  assert.match(eventRegistration, /register_event_waiting/);
  assert.match(waitingRoute, /remaining/);
  assert.match(registrationRoute, /EVENT_FULL/);
  assert.match(registrationRoute, /lineTestBypass/);
  assert.match(registrationRoute, /schoolEmailTestBypass/);
  assert.match(registrationRoute, /PROFILE_REQUIRED/);
  assert.match(registrationRoute, /PROFILE_INVALID/);
  assert.match(registrationRoute, /AUTH_REQUIRED/);
  assert.match(registrationRoute, /AGE_CONFIRMATION_REQUIRED/);
  assert.match(registrationRoute, /CONTACT_INVALID/);
  assert.match(registrationRoute, /isLocalTestHostname/);
  assert.match(eventRegistration, /recordLocalTestRegistration/);
  assert.match(eventRegistration, /RegistrationProfile/);
  assert.match(session, /HttpOnly/);
  assert.match(schoolEmail, /aoyama/);
  assert.match(authEmail, /AUTH_EMAIL_EXCEPTIONS/);
  assert.match(registrationRoute, /isAllowedAuthEmail/);
  assert.match(iosAuthScreen, /EMAIL_ADDRESS_PATTERN/);
  assert.doesNotMatch(iosAuthScreen, /AOYAMA_EMAIL\s*=/);
  assert.match(schoolEmail, /ac/);
  assert.match(localTest, /localhost/);
  assert.match(localTest, /127\.0\.0\.1/);
  assert.match(page, /local-test-note/);
  assert.match(page, /テスト参加を開始する/);
  assert.match(page, /utility-menu/);
  assert.match(page, /menu-button/);
  assert.doesNotMatch(page, /skipLineForLocalTest/);
  assert.doesNotMatch(page, /safety-link/);
  assert.match(envExample, /DATABASE_URL=/);
  assert.match(migration, /ADD COLUMN "capacity"/);
  assert.match(migration, /ADD COLUMN "waiting_count"/);
  assert.match(migration, /register_event_waiting/);
  assert.match(profileMigration, /event_registrations_nickname_length/);
  assert.match(profileMigration, /register_event_waiting/);
  assert.match(fullMigration, /CREATE TABLE "users"/);
  assert.match(fullMigration, /CREATE TABLE "event_pairs"/);
  assert.match(fullMigration, /CREATE TABLE "pair_decisions"/);
  assert.match(fullMigration, /CREATE TABLE "line_reminder_deliveries"/);
  assert.match(fullMigration, /register_event_waiting/);
  assert.match(authRoute, /verifyAuthenticationCode/);
  assert.match(authVerification, /AUTH_CODE_MAX_ATTEMPTS/);
  assert.match(authRoute, /setAuthCookie/);
  assert.match(lineRoute, /x-line-signature/);
  assert.match(pairRoute, /INSTAGRAM_CONTACT_REQUIRED/);
  assert.match(adminPage, /ADMIN_EMAILS|isAdminEmail/);
  assert.match(cronRoute, /onConflictDoNothing/);
  assert.match(cronRoute, /returning/);
  assert.match(envExample, /RESEND_API_KEY=/);
  assert.match(envExample, /AUTH_EMAIL_EXCEPTIONS=/);
  assert.match(envExample, /LINE_CHANNEL_SECRET=/);
  assert.match(envExample, /CRON_SECRET=/);
  assert.match(layout, /lang="ja"/);
  assert.match(layout, /set-mob \| 青学生限定の土曜マッチング/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
