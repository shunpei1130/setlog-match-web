import { DecisionScreen } from "@/components/decision-screen";
import { AppProvider, useApp } from "@/context/app-context";
import { mobileApi } from "@/lib/api";
import { readAccessToken } from "@/lib/storage";
import type { EventState, RemotePair } from "@/types";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  mobileApi: { me: jest.fn(), lineStatus: jest.fn(), participation: jest.fn() },
}));
jest.mock("@/lib/storage", () => ({
  ...jest.requireActual("@/lib/storage"),
  readAccessToken: jest.fn(),
  restoreApiEnvironment: jest.fn().mockResolvedValue(undefined),
}));

const pair: RemotePair = {
  id: "pair-draft", eventKey: "sat-2026-10-24", startsAt: "2026-10-24T03:00:00Z",
  decisionOpensAt: "2026-10-24T13:00:00Z", decisionOpen: true, status: "published",
  setlogUrl: null, setlogCode: null, kind: "weekly",
  candidate: { id: "other", nickname: "相手", faculty: "経済学部", academicYear: "2年", gender: "other" },
  decision: null, partnerAnswered: false, result: null,
};
const event: EventState = {
  eventKey: pair.eventKey, startsAt: pair.startsAt, decisionOpensAt: pair.decisionOpensAt,
  registrationClosesAt: pair.startsAt, updatedAt: pair.startsAt, registration: null,
  registrationOpen: false, decisionOpen: true, canCancel: false,
  matchingStatus: "matched", count: 2, capacity: 100, remaining: 98,
};

function Participation() {
  const app = useApp();
  if (app.phase === "decision" && app.pair && app.user) return <DecisionScreen
    pair={app.pair} user={app.user} busy={app.busy} onSubmit={app.submitDecision}
    onRefresh={app.refresh} onBlock={app.blockPair} onReport={app.reportPair} />;
  return <><Text>{`${app.phase}:${app.pair?.id ?? "none"}`}</Text>
    {app.phase === "pair" ? <Pressable onPress={app.openDecision}><Text>回答画面を開く</Text></Pressable> : null}</>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(readAccessToken).mockResolvedValue("test-session");
  jest.mocked(mobileApi.me).mockResolvedValue({ authenticated: true, user: {
    id: "self", email: "student@aoyama.jp", lineLinked: true, lineFollowed: true,
    instagramHandle: "test_handle", lineContact: "test_line",
  } });
  jest.mocked(mobileApi.lineStatus).mockResolvedValue({ linked: true, followed: true, officialAccountUrl: null });
  jest.mocked(mobileApi.participation).mockReset().mockImplementation(async () => ({ event, pair: { ...pair } }));
});

afterEach(() => { jest.useRealTimers(); });

async function openDecision() {
  const screen = await render(<AppProvider><Participation /></AppProvider>);
  await act(async () => { jest.advanceTimersByTime(0); });
  await fireEvent.press(screen.getByText("回答画面を開く"));
  await fireEvent.press(screen.getByText("Instagramを交換したい"));
  return screen;
}

test("30秒後の自動更新で回答画面と未送信の選択を保ち、確定結果には遷移する", async () => {
  const screen = await openDecision();
  await act(async () => { jest.advanceTimersByTime(30_000); });
  expect(mobileApi.participation).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("checkbox", { name: /Instagramを交換したい/ }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByText("この内容で回答する")).toBeTruthy();

  jest.mocked(mobileApi.participation).mockResolvedValue({ event, pair: {
    ...pair, result: { kind: "disclosed", items: ["instagram"], contacts: { instagram: "partner_handle" } },
  } });
  await act(async () => { jest.advanceTimersByTime(30_000); });
  expect(screen.getByText("result:pair-draft")).toBeTruthy();
  expect(screen.queryByText("この内容で回答する")).toBeNull();
});

test.each(["other-pair", "ended"] as const)("自動更新の%sは回答画面を維持せず反映する", async (scenario) => {
  const screen = await openDecision();
  jest.mocked(mobileApi.participation).mockResolvedValue(scenario === "other-pair"
    ? { event, pair: { ...pair, id: "different-pair" } }
    : { event: { ...event, matchingStatus: "ended" }, pair: null });
  await act(async () => { jest.advanceTimersByTime(30_000); });
  expect(screen.getByText(scenario === "other-pair" ? "pair:different-pair" : "ended:none")).toBeTruthy();
  expect(screen.queryByText("この内容で回答する")).toBeNull();
});
