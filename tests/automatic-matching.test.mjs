import assert from "node:assert/strict";
import test from "node:test";
import { maximumMatching } from "../lib/matching.ts";
import { normalizeSetlogInvite } from "../lib/setlog-invite.ts";
import { scheduleForEventKey, timingForEvent } from "../lib/event-schedule.ts";
import { validateReleaseConfiguration } from "../ios/release-config.cjs";

function oracle(graph, remaining = graph.map((_, index) => index)) {
  if (!remaining.length) return 0;
  const [first, ...rest] = remaining;
  let best = oracle(graph, rest);
  for (const next of rest) if (graph[first].includes(next)) best = Math.max(best, 1 + oracle(graph, rest.filter((item) => item !== next)));
  return best;
}

test("maximum matching agrees with exhaustive search, including odd cycles", () => {
  let seed = 193841;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let n = 0; n <= 10; n += 1) for (let run = 0; run < 120; run += 1) {
    const graph = Array.from({ length: n }, () => []);
    for (let a = 0; a < n; a += 1) for (let b = a + 1; b < n; b += 1) if (random() < 0.4) { graph[a].push(b); graph[b].push(a); }
    const result = maximumMatching(graph);
    for (let index = 0; index < n; index += 1) if (result[index] !== -1) {
      assert.ok(graph[index].includes(result[index]));
      assert.equal(result[result[index]], index);
    }
    assert.equal(result.filter((item) => item !== -1).length / 2, oracle(graph));
    assert.deepEqual(maximumMatching(graph), result);
  }
});

test("100 mutually compatible participants form 50 disjoint pairs", () => {
  const graph = Array.from({ length: 100 }, (_, index) => Array.from({ length: 100 }, (_, other) => other).filter((other) => other !== index));
  assert.equal(maximumMatching(graph).filter((item) => item !== -1).length, 100);
});

test("Setlog invitation input only opens a recognized HTTPS invitation", () => {
  for (const input of ["#abc1234", "abc1234", "https://setlog.app/invite/abc1234", "https://newchat.kr/invite/abc1234/"]) {
    assert.deepEqual(normalizeSetlogInvite(input), { code: "abc1234", url: "https://setlog.kr/invite/abc1234" });
  }
  for (const input of ["javascript:alert(1)", "https://setlog.kr.evil.example/invite/a", "https://user@setlog.kr/invite/a", "https://setlog.kr:444/invite/a", "https://setlog.kr/invite/a?next=https://bad.example", "abc 123", null]) assert.equal(normalizeSetlogInvite(input), null);
});

test("Sunday keys and the 23:00 deadline are validated on the server", () => {
  const sunday = scheduleForEventKey("sun-2026-10-25");
  assert.equal(sunday.startsAt.toISOString(), "2026-10-25T03:00:00.000Z");
  assert.throws(() => scheduleForEventKey("sun-2026-10-24"));
  assert.equal(timingForEvent(sunday.startsAt, new Date("2026-10-25T13:59:59Z")).decisionOpen, true);
  assert.equal(timingForEvent(sunday.startsAt, new Date("2026-10-25T14:00:00Z")).decisionOpen, false);
  assert.equal(timingForEvent(sunday.startsAt, new Date("2026-10-25T14:00:00Z")).ended, true);
});

test("release builds fail closed on missing, local, or shared API origins", () => {
  const valid = { SET_MOB_RELEASE: "true", EXPO_PUBLIC_API_BASE_URL: "https://setlog-match-web.vercel.app", EXPO_PUBLIC_REVIEW_API_BASE_URL: "https://set-mob-review.vercel.app" };
  assert.equal(validateReleaseConfiguration(valid), true);
  assert.throws(() => validateReleaseConfiguration({ SET_MOB_RELEASE: "true" }));
  for (const origin of ["http://example.org", "https://localhost", "https://127.0.0.1", "https://192.168.1.20", "https://[::1]", "https://host.example", "https://your-app.example.org", "https://your-setlog-match.example.com", "https://host.example/path", "https://host.example?token=x"]) assert.throws(() => validateReleaseConfiguration({ ...valid, EXPO_PUBLIC_API_BASE_URL: origin }));
  assert.throws(() => validateReleaseConfiguration({ ...valid, EXPO_PUBLIC_REVIEW_API_BASE_URL: valid.EXPO_PUBLIC_API_BASE_URL }));
  assert.throws(() => validateReleaseConfiguration({ ...valid, EXPO_PUBLIC_REVIEW_API_BASE_URL: "https://SETLOG-MATCH-WEB.vercel.app/" }));
  assert.throws(() => validateReleaseConfiguration({ ...valid, EAS_BUILD: "true" }));
});

test("matching result messages cover matched and unmatched participants", async () => {
  const { matchingResultMessage } = await import("../lib/matching-message.ts");
  const matched = matchingResultMessage(true);
  assert.match(matched, /マッチングが成立しました/);
  assert.match(matched, /22:00〜23:00/);
  const unmatched = matchingResultMessage(false);
  assert.match(unmatched, /相手がいませんでした/);
  assert.match(unmatched, /次回土曜/);
  assert.notEqual(matched, unmatched);
});
