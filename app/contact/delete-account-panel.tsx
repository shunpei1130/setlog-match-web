"use client";

import { useState } from "react";

export default function DeleteAccountPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const deleteAccount = async () => {
    if (confirmation !== "削除する") return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/me", { method: "DELETE" });
      if (response.status === 401) {
        setNotice("ログイン後に実行できます。トップ画面でメール認証を完了してください。");
        return;
      }
      if (!response.ok) throw new Error("delete failed");
      window.localStorage.removeItem("set-mob-state-v1");
      window.localStorage.removeItem("setlog-match-mvp-state-v4");
      window.location.assign("/?account=deleted");
    } catch {
      setNotice("削除できませんでした。時間を置いて再試行するか、運営へ連絡してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="legal-section danger-zone">
      <h2>アカウントと登録データを削除</h2>
      <p>ログイン中の本人データ、参加登録、回答、連絡先を削除します。安全対応や法令上必要な記録は、必要期間だけ分離保管する場合があります。</p>
      <label htmlFor="delete-confirmation">確認のため「削除する」と入力</label>
      <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
      <button className="danger-button" type="button" onClick={() => void deleteAccount()} disabled={busy || confirmation !== "削除する"}>{busy ? "削除中…" : "アカウントを削除する"}</button>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
    </section>
  );
}
