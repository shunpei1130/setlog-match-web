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
        setNotice("アカウントを削除するにはログインが必要です。参加画面でメール認証をしてください。");
        return;
      }
      if (!response.ok) throw new Error("delete failed");
      window.localStorage.removeItem("set-mob-state-v1");
      window.localStorage.removeItem("setlog-match-mvp-state-v4");
      // A full navigation discards the deleted account's in-memory profile and session state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/?account=deleted");
    } catch {
      setNotice("削除できませんでした。時間をおいてもう一度お試しいただくか、運営へお問い合わせください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="legal-section danger-zone">
      <h2>アカウントと登録データを削除</h2>
      <p>プロフィール、参加登録、回答、連絡先を削除します。削除すると元に戻せません。Setlogのアカウントや投稿は削除されません。安全対応や法令上必要な記録は、必要な期間だけ分けて保管する場合があります。</p>
      <label htmlFor="delete-confirmation">確認のため「削除する」と入力してください</label>
      <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
      <button className="danger-button" type="button" onClick={() => void deleteAccount()} disabled={busy || confirmation !== "削除する"}>{busy ? "削除中…" : "アカウントを削除する"}</button>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
    </section>
  );
}
