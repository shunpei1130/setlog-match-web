const callbackMessages: Record<string, string> = {
  linked: "LINE連携が完了しました。",
  "linked-not-following": "LINE連携は完了しました。公式アカウントを友だち追加してください。",
  "already-linked": "このLINEアカウントは別の利用者に連携されています。",
  cancelled: "LINE連携をキャンセルしました。",
  expired: "LINE連携の有効期限が切れました。もう一度お試しください。",
  "invalid-state": "LINE連携を確認できませんでした。もう一度お試しください。",
  unavailable: "LINE連携を完了できませんでした。",
};

export function lineCallbackStatus(url: string) {
  try {
    return new URL(url).searchParams.get("status");
  } catch {
    return null;
  }
}

export function lineCallbackMessage(status: string | null) {
  return callbackMessages[status ?? ""] ?? "LINEの状態を確認しました。";
}
