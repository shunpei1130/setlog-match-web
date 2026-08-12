import { lineCallbackMessage, lineCallbackStatus } from "@/lib/line-callback";

describe("LINE callback", () => {
  test.each([
    ["linked", "LINE連携が完了しました。"],
    ["linked-not-following", "公式アカウントを友だち追加してください。"],
    ["already-linked", "別の利用者"],
    ["expired", "有効期限"],
    ["invalid-state", "確認できませんでした"],
  ])("%sを個別表示する", (status, message) => {
    const url = `setmob://line-callback?status=${status}`;
    expect(lineCallbackStatus(url)).toBe(status);
    expect(lineCallbackMessage(lineCallbackStatus(url))).toContain(message);
  });

  test("不正なURLでも例外にしない", () => {
    expect(lineCallbackStatus("not a url")).toBeNull();
    expect(lineCallbackMessage(null)).toBe("LINEの状態を確認しました。");
  });
});
