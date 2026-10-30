"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EventState, RemotePair, PairDecision } from "../ios/src/types";
import "./live-participation.css";

type Snapshot = { event: EventState; pair: RemotePair | null };
const emptyDecision: PairDecision = { instagram: false, line: false, continue: false, none: false, answered: false };
const messages: Record<string, string> = {
  SETLOG_INVITE_INVALID: "Setlogの招待リンクか、英数字の招待コードを入力してください。",
  SETLOG_INVITE_ALREADY_SAVED: "相手が先に招待コードを共有しました。最新の内容を確認してください。",
  SETLOG_INVITE_LOCKED: "相手が参加済みのため、招待コードは変更できません。",
  SETLOG_INVITE_CLOSED: "招待コードを共有できる時間は終了しました。",
  DECISION_NOT_OPEN: "回答できるのは22:00〜23:00です。",
  DECISION_CLOSED: "回答の受け付けは23時で終了しました。",
  DECISION_FINALIZED: "お互いの回答がそろい、結果が確定しています。",
  INSTAGRAM_CONTACT_REQUIRED: "Instagramを交換するには、先にユーザーネームを登録してください。",
  LINE_CONTACT_REQUIRED: "LINEを交換するには、先にIDか友だち追加リンクを登録してください。",
};

export default function LiveParticipation({ onRegister, onExpired }: { onRegister: (eventKey: string) => void; onExpired: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const [decision, setDecision] = useState(emptyDecision);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const busyRef = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    try {
      const response = await fetch("/api/me/participation", { cache: "no-store", signal: current.signal });
      if (response.status === 401) { onExpired(); return; }
      if (!response.ok) throw new Error("参加状況を確認できませんでした。もう一度お試しください。");
      const payload = await response.json() as Snapshot;
      if (!current.signal.aborted) setSnapshot(payload);
    } catch (error) { if (!current.signal.aborted) setNotice(error instanceof Error ? error.message : "通信に失敗しました。"); }
  }, [onExpired]);

  useEffect(() => {
    const start = setTimeout(() => void load(), 0);
    const interval = setInterval(() => { if (!busyRef.current) void load(); }, 30_000);
    const active = () => { if (!document.hidden && !busyRef.current) void load(); };
    document.addEventListener("visibilitychange", active);
    return () => { clearTimeout(start); clearInterval(interval); controller.current?.abort(); document.removeEventListener("visibilitychange", active); };
  }, [load]);

  const act = async (path: string, method: string, body?: unknown) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (response.status === 401) { onExpired(); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(messages[payload.error] ?? "操作を完了できませんでした。もう一度お試しください。");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "通信に失敗しました。"); await load(); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const next = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/me/participation?next=true", { cache: "no-store" });
      if (!response.ok) throw new Error("次回の参加状況を確認できませんでした。");
      const payload = await response.json() as Snapshot;
      onRegister(payload.event.eventKey);
    } catch (error) { setNotice(error instanceof Error ? error.message : "通信に失敗しました。"); }
    finally { setBusy(false); }
  };
  const copyInvite = async () => {
    try {
      if (!navigator.clipboard || !snapshot?.pair?.setlogCode) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(snapshot.pair.setlogCode);
      setNotice("招待コードをコピーしました。");
    } catch { setNotice("コピーできませんでした。表示された招待コードを選択してコピーしてください。"); }
  };
  const event = snapshot?.event;
  const pair = snapshot?.pair;
  const result = pair?.result;
  const date = event ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date(event.startsAt)) : "";
  const options: Array<["instagram" | "line" | "continue" | "none", string]> = [["instagram", "Instagramを交換したい"], ["line", "LINEを交換したい"], ["none", "今回はここで終える"]];
  if (pair?.kind !== "extension") options.splice(2, 0, ["continue", "明日（日曜）も続けたい"]);

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><strong>set-mob</strong></div><Link className="secondary-button" href="/contact">お問い合わせ</Link></header>
    <main className="app-main"><section className="page-section narrow-section live-participation">
      <p className="eyebrow">{date} / {event?.kind === "extension" ? "日曜も同じ相手と" : "今日の参加"}</p>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {!snapshot ? <><h2>参加状況を確認しています。</h2><button className="secondary-button" onClick={() => void load()}>もう一度確認する</button></> : !pair ? <>
        <h2>{event?.matchingStatus === "unmatched" ? "今回は相手が見つかりませんでした。" : event?.matchingStatus === "ended" ? "今回の共有は終了しました。" : event?.registration?.status === "cancelled" ? "参加をキャンセルしました。" : event?.matchingStatus === "processing" ? "今日の相手を探しています。" : "開始時刻を待っています。"}</h2>
        <p className="section-lede">{event?.matchingStatus === "unmatched" ? "条件に合う相手が見つからなかったため、今回の参加は終了です。また参加したいときは、次の土曜にご登録ください。" : event?.matchingStatus === "ended" ? "相手の情報は表示されません。" : event?.registration?.status === "cancelled" ? "受付中であれば、もう一度参加登録できます。" : event?.matchingStatus === "processing" ? "少し時間をおいて、もう一度確認してください。" : `${date} 12:00に、この画面から今日の相手を確認してください。条件に合う相手が見つからない場合もあります。`}</p>
        {event?.matchingStatus === "unmatched" || event?.matchingStatus === "ended" ? <button className="primary-button full-width" disabled={busy} onClick={() => void next()}>次の土曜の参加登録へ</button> : <button className="primary-button full-width" disabled={busy} onClick={() => void load()}>今日の相手を確認する</button>}
        {event?.canCancel && event.registration?.status === "waiting" ? <button className="secondary-button full-width" disabled={busy} onClick={() => void act(`/api/events/${event.eventKey}/registrations`, "DELETE")}>今回の参加をキャンセルする</button> : null}
        {event?.registration?.status !== "waiting" && event?.registrationOpen ? <button className="secondary-button" onClick={() => onRegister(event.eventKey)}>参加登録する</button> : null}
      </> : result && result.kind !== "pending" ? <>
        <h2>{result.kind === "disclosed" ? "お互いに、連絡先の交換を希望しました。" : result.kind === "continued" ? pair.extension?.status === "cancelled" ? "日曜の共有はキャンセルされました。" : "日曜も、同じ相手と。" : "今日は、ここまで。"}</h2>
        {result.kind === "disclosed" ? <><p className="section-lede">二人とも交換を希望した連絡先だけを表示しています。ここからは、お互いのペースでやりとりしてください。</p>{Object.entries(result.contacts ?? {}).map(([channel, contact]) => <div key={channel} className="live-contact"><strong>{channel === "instagram" ? "Instagram" : "LINE"}</strong><code>{contact}</code></div>)}</> : <p className="section-lede">{result.kind === "continued" && pair.extension?.status !== "cancelled" ? "お互いに、明日も続けることを希望しました。日曜12時から、Setlogの同じログで一日を共有します。今回は連絡先を交換しません。" : "お互いの回答内容や、終了した理由は表示されません。"}</p>}
        {pair.extension?.canCancel ? <button className="secondary-button full-width" disabled={busy} onClick={() => void act(`/api/events/${pair.extension!.eventKey}/registrations`, "DELETE")}>日曜の共有をキャンセルする</button> : null}
        {result.kind !== "continued" || pair.extension?.status === "cancelled" ? <button className="primary-button full-width" disabled={busy} onClick={() => void next()}>次の土曜の参加登録へ</button> : null}
      </> : <>
        <h2>今日の相手は、{pair.candidate.nickname}さん。</h2>
        <p className="section-lede">{pair.candidate.faculty} / {pair.candidate.academicYear}</p>
        {pair.setlogCode ? <div className="live-contact"><span>Setlogの招待コード</span><code>{pair.setlogCode}</code><button className="secondary-button" onClick={() => void copyInvite()}>招待コードをコピーする</button>{pair.setlogUrl ? <a className={pair.decisionOpen ? "secondary-button" : "primary-button"} href={pair.setlogUrl} target="_blank" rel="noopener noreferrer">Setlogを開く</a> : null}{!pair.invite?.joined ? <button className="secondary-button" disabled={busy} onClick={() => void act(`/api/pairs/${pair.id}/setlog-invite`, "POST")}>Setlogに参加したことを知らせる</button> : <p>Setlogに参加したことを確認しました。</p>}</div> : <p className="section-lede">{pair.invite?.suggestedCreator ? "外部アプリのSetlogで新しいログを作り、招待コードをここで相手に共有してください。" : "相手からの招待コードを待っています。ご自身でSetlogのログを作り、招待コードを共有することもできます。"}</p>}
        {pair.invite?.canEdit ? <form onSubmit={(e) => { e.preventDefault(); void act(`/api/pairs/${pair.id}/setlog-invite`, "PUT", { invite }); }}><label htmlFor="live-invite">Setlogの招待リンク・招待コード</label><input id="live-invite" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" spellCheck={false} /><button className="secondary-button full-width" disabled={busy || !invite.trim()}>招待コードを相手に送る</button></form> : null}
        {pair.decisionOpen && !pair.decision?.answered ? <form onSubmit={(e) => { e.preventDefault(); void act(`/api/pairs/${pair.id}/decision`, "POST", decision); }}><h3>今日の振り返り</h3><p>回答は相手に表示されません。お互いの回答がそろうと、二人とも交換を希望した連絡先だけを表示します。</p>{pair.kind !== "extension" ? <p>「明日（日曜）も続けたい」を選んだ場合は、今回は連絡先を交換しません。</p> : null}<p>回答できるのは22:00〜23:00です。</p><fieldset><legend>この先どうしたいですか？（複数選択可）</legend>{options.map(([key, label]) => <label key={key} className="live-option"><input type="checkbox" checked={decision[key]} onChange={() => setDecision((old) => ({ ...old, [key]: !old[key], ...(key === "none" ? { instagram: false, line: false, continue: false } : { none: false }) }))} />{label}</label>)}</fieldset><button className="primary-button full-width" disabled={busy || !Object.entries(decision).some(([key, checked]) => key !== "answered" && checked)}>この内容で回答する</button></form> : <p className="section-lede">{pair.decision?.answered ? "回答を受け付けました。相手の回答を待っています。回答は相手に表示されません。" : "この先どうしたいかは、22:00〜23:00に回答できます。"}</p>}
      </>}
      {pair ? <details className="live-safety"><summary>ブロック・通報</summary><button className="danger-button" disabled={busy} onClick={() => void act(`/api/pairs/${pair.id}/block`, "POST")}>ブロックして終了する</button><form onSubmit={(e) => { e.preventDefault(); void act(`/api/pairs/${pair.id}/report`, "POST", { reason, detail }); }}><label htmlFor="live-reason">通報理由</label><select id="live-reason" value={reason} onChange={(e) => setReason(e.target.value)} required><option value="">選択してください</option><option>嫌がらせ</option><option>勧誘・金銭要求</option><option>その他</option></select><label htmlFor="live-detail">補足（任意）</label><textarea id="live-detail" maxLength={1000} value={detail} onChange={(e) => setDetail(e.target.value)} /><button className="danger-button" disabled={busy || !reason}>運営に通報して終了する</button></form></details> : null}
      <p className="waiting-note">Setlogでの退出・ブロックは、Setlogで操作してください。</p>
    </section></main>
    <footer className="app-footer"><nav aria-label="規約とサポート"><Link href="/terms">利用規約</Link><Link href="/privacy">プライバシー</Link><Link href="/safety">安全ガイド</Link><Link href="/contact">お問い合わせ・退会</Link></nav><span>set-mobは独立運営です。青山学院大学およびSetlogの公式・公認サービスではありません。</span></footer>
  </div>;
}
