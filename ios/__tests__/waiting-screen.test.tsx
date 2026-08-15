import { WaitingScreen } from "@/components/waiting-screen";
import type { EventState } from "@/types";
import { fireEvent, render } from "@testing-library/react-native";

function event(overrides: Partial<EventState> = {}): EventState {
  return {
    eventKey: "sat-2026-08-15",
    registration: {
      status: "waiting",
      lineStatus: "registered",
      nickname: "あお",
      faculty: "経済学部",
      academicYear: "2年",
      gender: "other",
      purpose: "either",
      preferredGender: "any",
      ageConfirmed: true,
      rulesAccepted: true,
    },
    count: 10,
    capacity: 100,
    remaining: 90,
    updatedAt: "2026-08-13T00:00:00.000Z",
    startsAt: "2026-08-15T03:00:00.000Z",
    registrationClosesAt: "2026-08-15T03:00:00.000Z",
    decisionOpensAt: "2026-08-15T13:00:00.000Z",
    registrationOpen: true,
    canCancel: true,
    decisionOpen: false,
    ...overrides,
  };
}

describe("待機画面", () => {
  test("開催日を表示し、開始前はキャンセルできる", async () => {
    const onCancel = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <WaitingScreen event={event()} busy={false} onStart={jest.fn()} onCancel={onCancel} />,
    );

    expect(screen.getByText("8/15(土)")).toBeTruthy();
    await fireEvent.press(screen.getByText("今回の参加をキャンセル"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("開始後はキャンセル操作を表示しない", async () => {
    const screen = await render(
      <WaitingScreen event={event({ canCancel: false })} busy={false} onStart={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.queryByText("今回の参加をキャンセル")).toBeNull();
  });
});
