import { AuthScreen } from "@/components/auth-screen";
import { mobileApi } from "@/lib/api";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/api", () => ({
  ApiError: Error,
  mobileApi: { requestCode: jest.fn() },
}));

const requestCode = mobileApi.requestCode as jest.Mock;

describe("メールOTP", () => {
  beforeEach(() => requestCode.mockReset());

  test("青学以外のメールを送信しない", async () => {
    const screen = await render(<AuthScreen busy={false} onBack={jest.fn()} onVerify={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText("青学メール"), "student@example.com");
    await fireEvent.press(screen.getByText("認証コードを送る"));

    expect(screen.getByText(/@aoyama\.jp/)).toBeTruthy();
    expect(requestCode).not.toHaveBeenCalled();
  });

  test("コード送信後は数字6桁だけで検証する", async () => {
    requestCode.mockResolvedValue({ sent: true, expiresIn: 600 });
    const onVerify = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<AuthScreen busy={false} onBack={jest.fn()} onVerify={onVerify} />);
    await fireEvent.changeText(screen.getByLabelText("青学メール"), "Student@aoyama.jp ");
    await fireEvent.press(screen.getByText("認証コードを送る"));
    await screen.findByLabelText("6桁の認証コード");
    await fireEvent.changeText(screen.getByLabelText("6桁の認証コード"), "12a3456");
    await fireEvent.press(screen.getByText("認証して続ける →"));

    await waitFor(() => expect(onVerify).toHaveBeenCalledWith("student@aoyama.jp", "123456"));
  });
});
