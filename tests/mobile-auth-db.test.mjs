import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test, { after } from "node:test";
import { neon } from "@neondatabase/serverless";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testBranchId = process.env.DB_TEST_BRANCH_ID;

if (!testDatabaseUrl || !/^br-[a-z0-9-]+$/i.test(testBranchId ?? "")) {
  throw new Error("DB tests require TEST_DATABASE_URL and a Neon DB_TEST_BRANCH_ID. Production DATABASE_URL alone is never accepted.");
}

const pepper = `db-test-${randomBytes(18).toString("hex")}`;
const runId = `${Date.now()}-${randomBytes(5).toString("hex")}`;
const email = `codex-mobile-db-${runId}@example.com`;
const sql = neon(testDatabaseUrl);

process.env.DATABASE_URL = testDatabaseUrl;
process.env.AUTH_SECRET_PEPPER = pepper;
process.env.AUTH_EMAIL_EXCEPTIONS = email;
process.env.ADMIN_EMAILS = email;
process.env.LINE_CHANNEL_ID = "db-test-line-channel";
process.env.LINE_CHANNEL_SECRET = "db-test-line-secret";
process.env.LINE_LOGIN_REDIRECT_URI = "http://localhost/api/line/callback";

let workerPromise;

function hashSecret(value) {
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

async function worker() {
  workerPromise ??= import(new URL(`../dist/server/index.js?db-test=${runId}`, import.meta.url)).then((module) => module.default);
  return workerPromise;
}

async function api(path, init = {}) {
  const app = await worker();
  return app.fetch(
    new Request(`http://localhost${path}`, {
      redirect: "manual",
      ...init,
      headers: { accept: "application/json", ...init.headers },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function createChallenge(code) {
  await sql`
    INSERT INTO authentication_codes (email, code_hash, expires_at)
    VALUES (${email}, ${hashSecret(code)}, now() + interval '10 minutes')
  `;
}

async function verifyMobile(code) {
  return api("/api/mobile/auth/verify-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

after(async () => {
  await sql`DELETE FROM authentication_codes WHERE email = ${email}`;
  await sql`DELETE FROM users WHERE email = ${email}`;
});

test("mobile auth works against an isolated Neon branch", async () => {
  const [migration] = await sql`
    SELECT to_regclass('public.line_login_states')::text AS table_name
  `;
  assert.equal(migration.table_name, "line_login_states");

  const firstCode = "102938";
  await createChallenge(firstCode);
  const invalidCode = await verifyMobile("000000");
  assert.equal(invalidCode.status, 400);
  assert.deepEqual(await invalidCode.json(), { error: "AUTH_CODE_INVALID" });

  const verified = await verifyMobile(firstCode);
  assert.equal(verified.status, 200);
  const verifiedBody = await verified.json();
  assert.equal(verifiedBody.authenticated, true);
  assert.match(verifiedBody.accessToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(verifiedBody.user.email, email);

  const me = await api("/api/mobile/me", { headers: bearer(verifiedBody.accessToken) });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, email);

  const malformed = await api("/api/mobile/me", { headers: { authorization: "Bearer invalid.token" } });
  assert.equal(malformed.status, 401);

  const expiredToken = `expired_${randomBytes(18).toString("base64url")}`;
  await sql`
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES (${verifiedBody.user.id}::uuid, ${hashSecret(expiredToken)}, now() - interval '1 minute')
  `;
  const expired = await api("/api/mobile/me", { headers: bearer(expiredToken) });
  assert.equal(expired.status, 401);

  const adminWithBearer = await api("/api/admin/reports", { headers: bearer(verifiedBody.accessToken) });
  assert.equal(adminWithBearer.status, 403);
  assert.deepEqual(await adminWithBearer.json(), { error: "ADMIN_REQUIRED" });

  const signOut = await api("/api/mobile/auth/sign-out", {
    method: "POST",
    headers: bearer(verifiedBody.accessToken),
  });
  assert.equal(signOut.status, 200);
  const revoked = await api("/api/mobile/me", { headers: bearer(verifiedBody.accessToken) });
  assert.equal(revoked.status, 401);

  const cookieCode = "564738";
  await createChallenge(cookieCode);
  const webVerified = await api("/api/auth/verify-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: cookieCode }),
  });
  assert.equal(webVerified.status, 200);
  const authCookie = webVerified.headers.get("set-cookie");
  assert.match(authCookie ?? "", /^setlog_auth_session=/);
  const cookieMe = await api("/api/mobile/me", { headers: { cookie: authCookie.split(";", 1)[0] } });
  assert.equal(cookieMe.status, 200);

  const lineCode = "675849";
  await createChallenge(lineCode);
  const lineVerified = await verifyMobile(lineCode);
  const lineToken = (await lineVerified.json()).accessToken;

  const lineStart = await api("/api/mobile/line/login", { method: "POST", headers: bearer(lineToken) });
  assert.equal(lineStart.status, 200);
  const lineStartBody = await lineStart.json();
  const lineState = new URL(lineStartBody.authorizeUrl).searchParams.get("state");
  assert.match(lineState ?? "", /^m_[A-Za-z0-9_-]+$/);

  const [storedState] = await sql`
    SELECT user_id::text AS user_id, consumed_at
    FROM line_login_states
    WHERE state_hash = ${hashSecret(lineState)}
  `;
  assert.equal(storedState.user_id, verifiedBody.user.id);
  assert.equal(storedState.consumed_at, null);

  const cancelled = await api(`/api/line/callback?state=${encodeURIComponent(lineState)}&error=access_denied`);
  assert.equal(cancelled.status, 307);
  assert.equal(new URL(cancelled.headers.get("location")).searchParams.get("status"), "cancelled");

  const reused = await api(`/api/line/callback?state=${encodeURIComponent(lineState)}&error=access_denied`);
  assert.equal(reused.status, 307);
  assert.equal(new URL(reused.headers.get("location")).searchParams.get("status"), "expired");

  const expiringStart = await api("/api/mobile/line/login", { method: "POST", headers: bearer(lineToken) });
  const expiringState = new URL((await expiringStart.json()).authorizeUrl).searchParams.get("state");
  await sql`
    UPDATE line_login_states
    SET expires_at = now() - interval '1 minute'
    WHERE state_hash = ${hashSecret(expiringState)}
  `;
  const expiredState = await api(`/api/line/callback?state=${encodeURIComponent(expiringState)}&error=access_denied`);
  assert.equal(new URL(expiredState.headers.get("location")).searchParams.get("status"), "expired");
});
