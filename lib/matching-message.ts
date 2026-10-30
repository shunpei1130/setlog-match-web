export function matchingResultMessage(matched: boolean): string {
  return matched
    ? "マッチングが成立しました！\n相手が決まっています。set-mobを開いて相手のプロフィールを確認し、Setlogの招待を共有しましょう。\n回答は今日22:00〜23:00です。\n\nset-mob"
    : "本日のマッチング結果\n今回は条件に合う相手がいませんでした。次回土曜のマッチングに、また登録をお待ちしています。\n\nset-mob";
}
