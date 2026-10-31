import { PairScreen } from "@/components/pair-screen";
import { DecisionScreen } from "@/components/decision-screen";
import { ResultScreen } from "@/components/result-screen";
import type { RemotePair } from "@/types";
import { fireEvent, render } from "@testing-library/react-native";
import * as Linking from "expo-linking";

const pair = (overrides: Partial<RemotePair> = {}): RemotePair => ({
  id: "pair-test", eventKey: "sat-2026-10-24", startsAt: "2026-10-24T03:00:00Z",
  decisionOpensAt: "2026-10-24T13:00:00Z", decisionOpen: false, status: "published",
  setlogUrl: null, setlogCode: null, kind: "weekly",
  candidate: { id: "other", nickname: "確認用B", faculty: "架空学部", academicYear: "2年", gender: "other" },
  decision: null, partnerAnswered: false, result: null,
  invite: { status: "waiting", canEdit: true, suggestedCreator: true, submittedByMe: false, joined: false }, ...overrides,
});
const user = { id: "u1", email: "student@aoyama.jp", lineLinked: true, lineFollowed: true, instagramHandle: null, lineContact: null };

test("自分で作った招待コードを共有し、共有済みなら参加確認できる", async () => {
  const onSaveInvite = jest.fn().mockResolvedValue(undefined), onConfirmJoined = jest.fn().mockResolvedValue(undefined);
  const props = { busy: false, setlogOpen: true, onOpenSetlog: jest.fn(), onCloseSetlog: jest.fn(), onDecision: jest.fn(),
    onBlock: jest.fn(), onReport: jest.fn(), onSaveInvite, onConfirmJoined };
  const screen = await render(<PairScreen pair={pair()} {...props} />);
  expect(screen.getByText("今はあなたの番です")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Setlogの招待リンク・招待コード"), "TestInvite123");
  await fireEvent.press(screen.getByText("招待コードを相手に送る"));
  expect(onSaveInvite).toHaveBeenCalledWith("TestInvite123");
  expect(screen.queryByText("Setlogに参加した")).toBeNull();
  await screen.rerender(<PairScreen pair={pair({ setlogCode: "TestInvite123", setlogUrl: "https://setlog.kr/invite/TestInvite123",
    invite: { status: "ready", canEdit: true, suggestedCreator: true, submittedByMe: true, joined: false } })} {...props} />);
  expect(screen.getByText("相手の番です")).toBeTruthy();
  expect(screen.getByText("相手の参加を待っています")).toBeTruthy();
  await fireEvent.press(screen.getByText("Setlogに参加した"));
  expect(onConfirmJoined).toHaveBeenCalledTimes(1);
}, 15_000); // Native platform views may need a cold Jest transform on the first render.

test("相手から届いた招待は、Setlogを開いてから参加確認が主操作になる", async () => {
  const onConfirmJoined = jest.fn().mockResolvedValue(undefined);
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const props = { busy: false, setlogOpen: true, onOpenSetlog: jest.fn(), onCloseSetlog: jest.fn(), onDecision: jest.fn(),
    onBlock: jest.fn(), onReport: jest.fn(), onSaveInvite: jest.fn(), onConfirmJoined };
  const received = pair({ setlogCode: "PartnerCode9", setlogUrl: "https://setlog.kr/invite/PartnerCode9",
    invite: { status: "ready", canEdit: false, suggestedCreator: false, submittedByMe: false, joined: false } });
  const screen = await render(<PairScreen pair={received} {...props} />);
  expect(screen.getByText("今はあなたの番です")).toBeTruthy();
  expect(screen.getByText("PartnerCode9")).toBeTruthy();
  await fireEvent.press(screen.getByText("Setlogを開く"));
  expect(openUrl).toHaveBeenCalledWith("https://setlog.kr/invite/PartnerCode9");
  await fireEvent.press(screen.getByText("Setlogに参加した"));
  expect(onConfirmJoined).toHaveBeenCalledTimes(1);
  openUrl.mockRestore();
}, 15_000);

test("相手が参加確認した送信者には、参加完了が表示される", async () => {
  const props = { busy: false, setlogOpen: true, onOpenSetlog: jest.fn(), onCloseSetlog: jest.fn(), onDecision: jest.fn(),
    onBlock: jest.fn(), onReport: jest.fn(), onSaveInvite: jest.fn(), onConfirmJoined: jest.fn() };
  const sent = pair({ setlogCode: "TestInvite123", setlogUrl: "https://setlog.kr/invite/TestInvite123",
    invite: { status: "ready", canEdit: false, suggestedCreator: true, submittedByMe: true, joined: false } });
  const screen = await render(<PairScreen pair={sent} {...props} />);
  expect(screen.getByText("相手がSetlogに参加しました")).toBeTruthy();
  expect(screen.queryByText("招待を変更する")).toBeNull();
}, 15_000);

test("日曜の判定には再延長の選択肢を表示せず、非開示で終了できる", async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<DecisionScreen pair={pair({ kind: "extension", decisionOpen: true })} user={user} busy={false}
    onSubmit={onSubmit} onRefresh={jest.fn()} onBlock={jest.fn()} onReport={jest.fn()} />);
  expect(screen.queryByText("明日（日曜）も続けたい")).toBeNull();
  await fireEvent.press(screen.getByText("今回はここで終える"));
  await fireEvent.press(screen.getByText("この内容で回答する"));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ none: true, continue: false, instagram: false, line: false }));
});

test("取消済みの日曜予約から次の土曜へ進める", async () => {
  const onNext = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<ResultScreen pair={pair({ result: { kind: "continued", items: ["continue"], contacts: null },
    extension: { eventKey: "sun-2026-10-25", startsAt: "2026-10-25T03:00:00Z", status: "cancelled", canCancel: false } })}
    onSignOut={jest.fn()} onNext={onNext} />);
  expect(screen.queryByText("日曜の参加をキャンセルする")).toBeNull();
  await fireEvent.press(screen.getByText("次の土曜の参加を確認する"));
  expect(onNext).toHaveBeenCalledTimes(1);
});
