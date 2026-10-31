import type { LineMessage } from "./line";

export function matchingResultMessage(matched: boolean): string {
  return matched
    ? "マッチングが成立しました！\n相手が決まっています。set-mobを開いて相手のプロフィールを確認し、Setlogの招待を共有しましょう。\n回答は今日22:00〜23:00です。\n\nset-mob"
    : "本日のマッチング結果\n今回は条件に合う相手がいませんでした。次回土曜のマッチングに、また登録をお待ちしています。\n\nset-mob";
}

// Buttons templates cap the body at 160 characters, so the button variant
// uses a shortened text; the full text stays in altText (and in the plain
// text fallback used whenever no LIFF URL is available).
const MATCHED_BUTTON_TEXT = "マッチングが成立しました！\n相手が決まっています。Setlogの招待を共有しましょう。\n回答は今日22:00〜23:00です。";

export function matchingResultMessages(matched: boolean, liffUrl: string | null): LineMessage[] {
  if (!matched || !liffUrl) {
    return [{ type: "text", text: matchingResultMessage(matched) }];
  }
  return [{
    type: "template",
    altText: matchingResultMessage(true),
    template: {
      type: "buttons",
      text: MATCHED_BUTTON_TEXT,
      actions: [{ type: "uri", label: "ペア画面を開く", uri: liffUrl }],
    },
  }];
}
