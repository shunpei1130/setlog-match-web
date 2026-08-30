import assert from "node:assert/strict";
import test from "node:test";
import { resolvePairResult } from "../lib/pair-result.ts";

const row = {
  participantAId: "user-a",
  participantBId: "user-b",
  aInstagram: "user_a",
  aLine: "line-a",
  bInstagram: "user_b",
  bLine: "line-b",
};

test("discloses only a channel selected by both users when both contacts exist", () => {
  const result = resolvePairResult(
    { instagram: true, line: false, continue: false, none: false },
    { instagram: true, line: false, continue: false, none: false },
    row,
    "user-a",
  );

  assert.deepEqual(result, {
    kind: "disclosed",
    items: ["instagram"],
    contacts: { instagram: "user_b" },
  });
});

test("does not disclose a channel when the partner has no saved contact", () => {
  const result = resolvePairResult(
    { instagram: true, line: false, continue: false, none: false },
    { instagram: true, line: false, continue: false, none: false },
    { ...row, bInstagram: null },
    "user-a",
  );

  assert.deepEqual(result, { kind: "ended", items: [], contacts: null });
});

test("does not disclose contacts when either user chooses to continue", () => {
  const result = resolvePairResult(
    { instagram: true, line: false, continue: true, none: false },
    { instagram: true, line: false, continue: false, none: false },
    row,
    "user-a",
  );

  assert.deepEqual(result, { kind: "ended", items: [], contacts: null });
});

test("returns a continued result only when both users choose to continue", () => {
  const result = resolvePairResult(
    { instagram: false, line: false, continue: true, none: false },
    { instagram: false, line: false, continue: true, none: false },
    row,
    "user-a",
  );

  assert.deepEqual(result, { kind: "continued", items: ["continue"], contacts: null });
});
