import assert from "node:assert/strict";
import test from "node:test";
import {
  currentWeeklyEventSchedule,
  scheduleForEventKey,
  timingForEvent,
} from "../lib/event-schedule.ts";

test("next-saturday resolves to a date-specific Saturday event in JST", () => {
  const friday = currentWeeklyEventSchedule(new Date("2026-08-14T12:00:00.000Z"));
  assert.equal(friday.eventKey, "sat-2026-08-15");
  assert.equal(friday.startsAt.toISOString(), "2026-08-15T03:00:00.000Z");

  const saturdayNight = currentWeeklyEventSchedule(new Date("2026-08-15T14:00:00.000Z"));
  assert.equal(saturdayNight.eventKey, "sat-2026-08-15");

  const sunday = currentWeeklyEventSchedule(new Date("2026-08-15T15:00:00.000Z"));
  assert.equal(sunday.eventKey, "sat-2026-08-22");
});

test("explicit event keys must identify a real Saturday", () => {
  assert.equal(
    scheduleForEventKey("sat-2026-09-26").decisionOpensAt.toISOString(),
    "2026-09-26T13:00:00.000Z",
  );
  assert.throws(() => scheduleForEventKey("sat-2026-09-25"), /EVENT_KEY_INVALID/);
  assert.throws(() => scheduleForEventKey("preview"), /EVENT_KEY_INVALID/);
});

test("registration closes at noon and decisions open at 22:00 JST", () => {
  const startsAt = new Date("2026-09-26T03:00:00.000Z");
  const beforeStart = timingForEvent(startsAt, new Date("2026-09-26T02:59:59.999Z"));
  assert.equal(beforeStart.registrationOpen, true);
  assert.equal(beforeStart.canCancel, true);
  assert.equal(beforeStart.decisionOpen, false);

  const beforeDecision = timingForEvent(startsAt, new Date("2026-09-26T12:59:59.999Z"));
  assert.equal(beforeDecision.registrationOpen, false);
  assert.equal(beforeDecision.canCancel, false);
  assert.equal(beforeDecision.decisionOpen, false);

  const atDecision = timingForEvent(startsAt, new Date("2026-09-26T13:00:00.000Z"));
  assert.equal(atDecision.decisionOpen, true);
});
