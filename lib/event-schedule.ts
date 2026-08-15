const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DECISION_DELAY_MS = 10 * 60 * 60 * 1000;

export const NEXT_EVENT_ALIAS = "next-saturday";

export type EventSchedule = {
  eventKey: string;
  startsAt: Date;
  registrationClosesAt: Date;
  decisionOpensAt: Date;
};

function dateKeyForJstDate(year: number, month: number, day: number) {
  return `sat-${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function scheduleFromStart(startsAt: Date): EventSchedule {
  const jst = new Date(startsAt.getTime() + JST_OFFSET_MS);
  return {
    eventKey: dateKeyForJstDate(jst.getUTCFullYear(), jst.getUTCMonth() + 1, jst.getUTCDate()),
    startsAt,
    registrationClosesAt: startsAt,
    decisionOpensAt: new Date(startsAt.getTime() + DECISION_DELAY_MS),
  };
}

export function currentWeeklyEventSchedule(now = new Date()): EventSchedule {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const daysUntilSaturday = (6 - jst.getUTCDay() + 7) % 7;
  const startsAt = new Date(Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate() + daysUntilSaturday,
    3,
    0,
    0,
    0,
  ));
  return scheduleFromStart(startsAt);
}

export function scheduleForEventKey(eventKey: string, now = new Date()): EventSchedule {
  if (eventKey === NEXT_EVENT_ALIAS) return currentWeeklyEventSchedule(now);

  const match = /^sat-(\d{4})-(\d{2})-(\d{2})$/.exec(eventKey);
  if (!match) throw new Error("EVENT_KEY_INVALID");
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const startsAt = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  const jst = new Date(startsAt.getTime() + JST_OFFSET_MS);
  if (
    jst.getUTCFullYear() !== year
    || jst.getUTCMonth() + 1 !== month
    || jst.getUTCDate() !== day
    || jst.getUTCDay() !== 6
  ) throw new Error("EVENT_KEY_INVALID");
  return scheduleFromStart(startsAt);
}

export function timingForEvent(startsAt: Date, now = new Date()) {
  const registrationClosesAt = startsAt;
  const decisionOpensAt = new Date(startsAt.getTime() + DECISION_DELAY_MS);
  return {
    startsAt: startsAt.toISOString(),
    registrationClosesAt: registrationClosesAt.toISOString(),
    decisionOpensAt: decisionOpensAt.toISOString(),
    registrationOpen: now < registrationClosesAt,
    canCancel: now < startsAt,
    decisionOpen: now >= decisionOpensAt,
  };
}
