import { RegistrationScreen } from "@/components/registration-screen";
import { fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("参加登録", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  test("別端末でもサーバーのプロフィールを表示し、参加同意は再確認する", async () => {
    const screen = await render(<RegistrationScreen
      user={{ id: "u1", email: "student@aoyama.jp", lineLinked: true, lineFollowed: true, instagramHandle: null, lineContact: null }}
      initialProfile={{ status: "cancelled", lineStatus: "registered", nickname: "復元された名前", faculty: "経済学部", academicYear: "2年", gender: "other", purpose: "friend", preferredGender: "any", ageConfirmed: true, rulesAccepted: true }}
      line={{ linked: true, followed: true, officialAccountUrl: null }} busy={false}
      onConnectLine={jest.fn()} onRefresh={jest.fn()} onRegister={jest.fn()} />);
    expect(screen.getByLabelText("ニックネーム（必須）").props.value).toBe("復元された名前");
    expect(screen.getByLabelText("学部（必須）").props.value).toBe("経済学部");
    await fireEvent.press(screen.getByText("参加登録を完了する"));
    expect(await screen.findByText("18歳以上であることと、安全ルールへの同意を確認してください。")).toBeTruthy();
  });

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

    await fireEvent.press(screen.getByText("参加登録を完了する"));
    expect(await screen.findByText(/プロフィールと、参加の目的・相手の性別の希望/)).toBeTruthy();
    expect(onRegister).not.toHaveBeenCalled();
  });
});
