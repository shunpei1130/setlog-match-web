import { AuthScreen } from "@/components/auth-screen";
import { mobileApi } from "@/lib/api";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/api", () => ({
  ApiError: Error,
  mobileApi: { requestCode: jest.fn() },
}));

const requestCode = mobileApi.requestCode as jest.Mock;

jest.setTimeout(15_000);

describe("メールOTP", () => {
  beforeEach(() => requestCode.mockReset());

  test("メール形式でない値を送信しない", async () => {
    const screen = await render(<AuthScreen busy={false} onBack={jest.fn()} onVerify={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText("大学のメールアドレス"), "student-example.com");
    await fireEvent.press(screen.getByText("認証コードを送る"));

    expect(screen.getByText("メールアドレスを入力してください。")).toBeTruthy();
    expect(requestCode).not.toHaveBeenCalled();
  });

  test("コード送信後は数字6桁だけで検証する", async () => {
    requestCode.mockResolvedValue({ sent: true, expiresIn: 600 });
    const onVerify = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<AuthScreen busy={false} onBack={jest.fn()} onVerify={onVerify} />);
    await fireEvent.changeText(screen.getByLabelText("大学のメールアドレス"), "Student@aoyama.jp ");
    await fireEvent.press(screen.getByText("認証コードを送る"));
    await screen.findByLabelText("6桁の認証コード");
    await fireEvent.changeText(screen.getByLabelText("6桁の認証コード"), "12a3456");
    await fireEvent.press(screen.getByText("確認して次へ進む"));

    await waitFor(() => expect(onVerify).toHaveBeenCalledWith("student@aoyama.jp", "123456"));
  });

  test("送信後にメールアドレスを修正して、新しい宛先へ送れる", async () => {
    requestCode.mockResolvedValue({ sent: true, expiresIn: 600 });
    const screen = await render(<AuthScreen busy={false} onBack={jest.fn()} onVerify={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText("大学のメールアドレス"), "wrong@aoyama.jp");
    await fireEvent.press(screen.getByText("認証コードを送る"));
    await screen.findByLabelText("6桁の認証コード");
    await fireEvent.press(screen.getByText("メールアドレスを変更する"));
    expect(screen.queryByLabelText("6桁の認証コード")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("大学のメールアドレス"), "correct@aoyama.jp");
    await fireEvent.press(screen.getByText("認証コードを送る"));
    await waitFor(() => expect(requestCode).toHaveBeenLastCalledWith("correct@aoyama.jp"));
  });

  test("再送の待ち時間が過ぎたら、同じ宛先へ新しいコードを送れる", async () => {
    jest.useFakeTimers();
    try {
      requestCode.mockResolvedValueOnce({ sent: true, expiresIn: 600, retryAfter: 2 })
        .mockResolvedValueOnce({ sent: true, expiresIn: 600 });
      const screen = await render(<AuthScreen busy={false} onBack={jest.fn()} onVerify={jest.fn()} />);
      await fireEvent.changeText(screen.getByLabelText("大学のメールアドレス"), "student@aoyama.jp");
      await fireEvent.press(screen.getByText("認証コードを送る"));
      await screen.findByText("あと2秒で再送できます");
      await fireEvent.press(screen.getByText("あと2秒で再送できます"));
      expect(requestCode).toHaveBeenCalledTimes(1);
      await act(async () => { jest.advanceTimersByTime(1000); });
      await act(async () => { jest.advanceTimersByTime(1000); });
      await fireEvent.changeText(screen.getByLabelText("6桁の認証コード"), "123456");
      await fireEvent.press(screen.getByText("認証コードをもう一度送る"));
      await waitFor(() => expect(requestCode).toHaveBeenCalledTimes(2));
      expect(screen.getByLabelText("6桁の認証コード").props.value).toBe("");
    } finally {
      jest.useRealTimers();
    }
  });
});
