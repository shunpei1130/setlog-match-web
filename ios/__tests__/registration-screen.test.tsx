import { RegistrationScreen } from "@/components/registration-screen";
import { fireEvent, render } from "@testing-library/react-native";

describe("参加登録", () => {
  test("必須プロフィールがない場合は登録APIを呼ばない", async () => {
    const onRegister = jest.fn().mockResolvedValue(true);
    const screen = await render(
      <RegistrationScreen
        user={{ id: "u1", email: "student@aoyama.jp", lineLinked: true, lineFollowed: true, instagramHandle: null, lineContact: null }}
        line={{ linked: true, followed: true, officialAccountUrl: null }}
        busy={false}
        onConnectLine={jest.fn()}
        onRefresh={jest.fn()}
        onRegister={onRegister}
      />,
    );

    await fireEvent.press(screen.getByText("参加登録を完了する →"));
    expect(await screen.findByText(/プロフィール、利用目的、希望する相手/)).toBeTruthy();
    expect(onRegister).not.toHaveBeenCalled();
  });
});
