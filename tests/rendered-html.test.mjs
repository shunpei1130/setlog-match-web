import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...init.headers }, ...init }),
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

test("keeps the MVP free of starter preview artifacts", async () => {
  const [page, layout, packageJson, schema, db, waitingRoute, registrationRoute, session, schoolEmail, envExample, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/[eventKey]/waiting-count/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/[eventKey]/registrations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/school-email.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_nosy_stellaris.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /localStorage/);
  assert.match(page, /SetlogAdapter/);
  assert.match(page, /青学の知らない人の一日/);
  assert.match(page, /次の土曜に事前登録する/);
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
  assert.match(schema, /pgTable/);
  assert.match(schema, /eventRegistrations/);
  assert.match(schema, /event_registrations_event_session_idx/);
  assert.match(db, /DATABASE_URL/);
  assert.match(db, /neon-http/);
  assert.match(waitingRoute, /getWaitingCount/);
  assert.match(registrationRoute, /onConflictDoUpdate/);
  assert.match(registrationRoute, /getOrCreateSessionId/);
  assert.match(registrationRoute, /AOYAMA_EMAIL_REQUIRED/);
  assert.match(session, /HttpOnly/);
  assert.match(schoolEmail, /aoyama\\.jp/);
  assert.match(schoolEmail, /aoyama\\.ac\\.jp/);
  assert.match(envExample, /DATABASE_URL=/);
  assert.match(migration, /CREATE TABLE "events"/);
  assert.match(migration, /CREATE TABLE "event_registrations"/);
  assert.match(page, /3人の土曜日を読む/);
  assert.match(layout, /lang="ja"/);
  assert.match(layout, /setlog \/ saturday issue \| 青学生限定/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
