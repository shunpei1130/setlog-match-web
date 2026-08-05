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

test("server-renders the Setlog Match MVP", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>setlog \/ saturday issue \| 青学生限定<\/title>/i);
  assert.match(html, /土曜日を準備しています/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("does not report zero when the waiting-count database is unavailable", async () => {
  const response = await render("/api/events/next-saturday/waiting-count");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "WAITING_COUNT_UNAVAILABLE" });
});

test("requires an Aoyama student email for registration", async () => {
  const response = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lineRegistered: true }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "AOYAMA_EMAIL_REQUIRED" });
});

test("requires LINE registration before accepting a valid registration", async () => {
  const response = await render("/api/events/next-saturday/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schoolEmail: "student@aoyama.jp" }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "LINE_REGISTRATION_REQUIRED" });
});

test("accepts the LINE bypass only on localhost", async () => {
  const body = JSON.stringify({ lineTestBypass: true, schoolEmailTestBypass: true });
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
  }, "setlog-match.example");
  assert.equal(productionResponse.status, 400);
  assert.deepEqual(await productionResponse.json(), { error: "LOCAL_TEST_BYPASS_NOT_ALLOWED" });
});

test("keeps the MVP free of starter preview artifacts", async () => {
  const [page, layout, packageJson, schema, db, eventRegistration, waitingRoute, registrationRoute, session, schoolEmail, localTest, envExample, migration] = await Promise.all([
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
    readFile(new URL("../lib/local-test.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_military_the_stranger.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /localStorage/);
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
  assert.match(page, /setlog-match-mvp-state-v3/);
  assert.match(page, /line-modal/);
  assert.match(page, /schoolEmail/);
  assert.match(page, /isAoyamaStudentEmail/);
  assert.match(page, /waitingCount/);
  assert.match(page, /waiting-count/);
  assert.match(page, /registrations/);
  assert.doesNotMatch(page, /髱貞|繧峨|縺/);
  assert.match(schema, /capacity/);
  assert.match(schema, /waitingCount/);
  assert.match(schema, /eventRegistrations/);
  assert.match(schema, /event_registrations_event_session_idx/);
  assert.match(db, /DATABASE_URL/);
  assert.match(db, /neon-http/);
  assert.match(eventRegistration, /INITIAL_EVENT_CAPACITY = 100/);
  assert.match(eventRegistration, /register_event_waiting/);
  assert.match(waitingRoute, /remaining/);
  assert.match(registrationRoute, /EVENT_FULL/);
  assert.match(registrationRoute, /lineTestBypass/);
  assert.match(registrationRoute, /schoolEmailTestBypass/);
  assert.match(registrationRoute, /isLocalTestHostname/);
  assert.match(eventRegistration, /recordLocalTestRegistration/);
  assert.match(session, /HttpOnly/);
  assert.match(schoolEmail, /aoyama/);
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
  assert.match(layout, /lang="ja"/);
  assert.match(layout, /setlog \/ saturday issue \| 青学生限定/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
