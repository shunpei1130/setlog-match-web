import { phaseFor } from "@/lib/phase";
import type { EventState, RemotePair } from "@/types";

const event = (registered: boolean): EventState => ({
  registration: registered ? {
    status: "waiting",
    lineStatus: "registered",
    nickname: "あお",
    faculty: "経済学部",
    academicYear: "2年",
    gender: "other",
    ageConfirmed: true,
    rulesAccepted: true,
  } : null,
  count: 10,
  capacity: 100,
  remaining: 90,
  updatedAt: "2026-08-11T00:00:00.000Z",
});

const pair = (overrides: Partial<RemotePair> = {}): RemotePair => ({
  id: "pair-1",
  eventKey: "next-saturday",
  status: "published",
  setlogUrl: "https://setlog.example/room",
  setlogCode: "123456",
  candidate: { id: "user-2", nickname: "りん", faculty: "文学部", academicYear: "3年", gender: "female" },
  decision: null,
  partnerAnswered: false,
  result: null,
  ...overrides,
});

describe("起動時の画面復元", () => {
  test("未登録・待機中・公開済みペアを振り分ける", () => {
    expect(phaseFor(event(false), null)).toBe("registration");
    expect(phaseFor(event(true), null)).toBe("waiting");
    expect(phaseFor(event(true), pair())).toBe("pair");
  });

  test("回答待ちと結果を振り分ける", () => {
    expect(phaseFor(event(true), pair({
      decision: { instagram: true, line: false, continue: false, none: false, answered: true },
      result: { kind: "pending", items: [], contacts: null },
    }))).toBe("decision");
    expect(phaseFor(event(true), pair({ result: { kind: "ended", items: [], contacts: null } }))).toBe("result");
  });
});
