"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Participant = {
  userId: string | null;
  email: string | null;
  nickname: string | null;
  faculty: string | null;
  academicYear: string | null;
  gender: string | null;
  purpose: "friend" | "romance" | "either";
  preferredGender: "any" | "male" | "female" | "other";
  status: string;
  lineStatus: string;
  lineFollowed: boolean | null;
  instagramHandle: string | null;
  lineContact: string | null;
  createdAt: string;
};

type Metrics = {
  totals: Record<string, number>;
  sources: Array<Record<string, string | number>>;
};

type Pair = {
  id: string;
  status: string;
  setlogUrl: string | null;
  setlogCode: string | null;
  participantAId: string;
  participantAEmail: string;
  participantBId: string;
  participantBEmail: string;
};

type PairDraft = {
  participantAId: string;
  participantBId: string;
  setlogUrl: string;
  setlogCode: string;
};

type Report = {
  id: string;
  pairId: string;
  reporterUserId: string;
  reason: string;
  detail: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

const EVENT_KEY = "next-saturday";

export default function AdminClient({ adminEmail }: { adminEmail: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totals: {}, sources: [] });
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [participantAId, setParticipantAId] = useState("");
  const [participantBId, setParticipantBId] = useState("");
  const [setlogUrl, setSetlogUrl] = useState("");
  const [setlogCode, setSetlogCode] = useState("");
  const [pairDrafts, setPairDrafts] = useState<Record<string, PairDraft>>({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [participantResponse, pairResponse, reportResponse, metricResponse] = await Promise.all([
        fetch(`/api/admin/events/${EVENT_KEY}/participants`, { cache: "no-store" }),
        fetch(`/api/admin/events/${EVENT_KEY}/pairs`, { cache: "no-store" }),
        fetch("/api/admin/reports", { cache: "no-store" }),
        fetch("/api/admin/metrics", { cache: "no-store" }),
      ]);
      if (!participantResponse.ok || !pairResponse.ok || !reportResponse.ok || !metricResponse.ok) throw new Error("load");
      setParticipants((await participantResponse.json()).participants ?? []);
      const loadedPairs = (await pairResponse.json()).pairs ?? [];
      setPairs(loadedPairs);
      setPairDrafts(Object.fromEntries(loadedPairs.map((pair: Pair) => [pair.id, {
        participantAId: pair.participantAId,
        participantBId: pair.participantBId,
        setlogUrl: pair.setlogUrl ?? "",
        setlogCode: pair.setlogCode ?? "",
      }])));
      const loadedReports = (await reportResponse.json()).reports ?? [];
      setReports(loadedReports);
      setReportNotes(Object.fromEntries(loadedReports.map((report: Report) => [report.id, report.adminNote ?? ""])));
      setMetrics(await metricResponse.json());
    } catch {
      setNotice("運営データを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (reportId: string, status: "open" | "reviewed" | "resolved") => {
    const response = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote: reportNotes[reportId] ?? "" }),
    });
    setNotice(response.ok ? "通報の対応状況を更新しました。" : "通報の対応状況を更新できませんでした。");
    if (response.ok) await load();
  };

  useEffect(() => {
    // The admin panel synchronizes its local view with the server after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const eligibleParticipants = useMemo(
    () => participants.filter((participant) => participant.userId && participant.status === "waiting"),
    [participants],
  );

  const getPairDraft = (pair: Pair): PairDraft => pairDrafts[pair.id] ?? {
    participantAId: pair.participantAId,
    participantBId: pair.participantBId,
    setlogUrl: pair.setlogUrl ?? "",
    setlogCode: pair.setlogCode ?? "",
  };

  const updatePairDraft = (pair: Pair, field: keyof PairDraft, value: string) => {
    const current = getPairDraft(pair);
    setPairDrafts((previous) => ({
      ...previous,
      [pair.id]: { ...current, [field]: value },
    }));
  };

  const createPair = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const response = await fetch(`/api/admin/events/${EVENT_KEY}/pairs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantAId, participantBId, setlogUrl, setlogCode }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setNotice(payload?.error === "PAIR_PREFERENCES_MISMATCH" ? "利用目的または希望する相手が一致しないため、このペアは作成できません。" : "ペアを作成できませんでした。参加者と入力内容を確認してください。");
      return;
    }
    setParticipantAId("");
    setParticipantBId("");
    setSetlogUrl("");
    setSetlogCode("");
    setNotice("ペアを作成しました。公開前にSetlog情報を確認してください。");
    await load();
  };

  const updatePair = async (
    pairId: string,
    action: "publish" | "unpublish" | "close" | "block" | "update",
    draft?: PairDraft,
  ) => {
    const currentDraft = draft ?? pairDrafts[pairId];
    const response = await fetch(`/api/admin/pairs/${pairId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        participantAId: currentDraft?.participantAId,
        participantBId: currentDraft?.participantBId,
        setlogUrl: currentDraft?.setlogUrl ?? setlogUrl,
        setlogCode: currentDraft?.setlogCode ?? setlogCode,
      }),
    });
    setNotice(response.ok ? "ペアの状態を更新しました。" : "ペアの状態を更新できませんでした。");
    if (response.ok) await load();
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">set-mob / 管理画面</p><h1>次回土曜を準備する。</h1></div>
        <div className="admin-header__account"><span>{adminEmail}</span><Link href="/">参加者画面</Link></div>
      </header>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-grid">
        <div className="admin-card">
          <div className="admin-card__heading"><div><span className="label">参加者</span><h2>登録一覧</h2></div><button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}>更新</button></div>
          {loading ? <p>読み込み中…</p> : <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">次回土曜の参加者</caption><thead><tr><th>名前</th><th>所属</th><th>希望</th><th>LINE</th><th>連絡先</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant.userId ?? participant.email}><td><strong>{participant.nickname ?? "未入力"}</strong><small>{participant.email ?? "未認証"}</small></td><td>{participant.faculty ?? "—"}<br />{participant.academicYear ?? "—"} / {participant.gender ?? "—"}</td><td><small>{participant.purpose === "friend" ? "友人" : participant.purpose === "romance" ? "恋愛" : "どちらでも"}<br />相手：{participant.preferredGender === "any" ? "問わない" : participant.preferredGender}</small></td><td>{participant.lineFollowed ? "友だち追加済み" : "未確認"}</td><td><small>IG: {participant.instagramHandle ?? "—"}<br />LINE: {participant.lineContact ?? "—"}</small></td></tr>)}</tbody></table></div>}
        </div>

        <form className="admin-card admin-form" onSubmit={createPair}>
          <span className="label">運営選定</span><h2>ペアを登録する</h2>
          <label htmlFor="pair-a">参加者A</label>
          <select id="pair-a" value={participantAId} onChange={(event) => setParticipantAId(event.target.value)} required><option value="">選択してください</option>{eligibleParticipants.map((participant) => <option key={participant.userId} value={participant.userId ?? ""}>{participant.nickname ?? participant.email}</option>)}</select>
          <label htmlFor="pair-b">参加者B</label>
          <select id="pair-b" value={participantBId} onChange={(event) => setParticipantBId(event.target.value)} required><option value="">選択してください</option>{eligibleParticipants.filter((participant) => participant.userId !== participantAId).map((participant) => <option key={participant.userId} value={participant.userId ?? ""}>{participant.nickname ?? participant.email}</option>)}</select>
          <label htmlFor="setlog-url">Setlog URL</label><input id="setlog-url" type="url" value={setlogUrl} onChange={(event) => setSetlogUrl(event.target.value)} placeholder="https://…" />
          <label htmlFor="setlog-code">参加コード</label><input id="setlog-code" type="text" value={setlogCode} onChange={(event) => setSetlogCode(event.target.value)} placeholder="例：SAT-001" />
          <button className="primary-button" type="submit">ペアを作成する</button>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card__heading"><div><span className="label">公開状態</span><h2>ペア一覧</h2></div></div>
        <div className="admin-pair-list">{pairs.length === 0 ? <p>まだペアがありません。</p> : pairs.map((pair) => {
          const draft = getPairDraft(pair);
          const options = participants.filter((participant) => participant.userId && (
            participant.status === "waiting"
            || participant.userId === pair.participantAId
            || participant.userId === pair.participantBId
          ));
          const editable = pair.status === "draft";
          return (
            <article className="admin-pair" key={pair.id}>
              <div>
                <strong>{pair.participantAEmail}</strong><span>×</span><strong>{pair.participantBEmail}</strong>
                <small>{pair.status} / {draft.setlogCode || "コード未設定"}</small>
              </div>
              <div className="admin-pair__edit">
                <label htmlFor={`pair-${pair.id}-a`}>参加者A</label>
                <select id={`pair-${pair.id}-a`} value={draft.participantAId} disabled={!editable} onChange={(event) => updatePairDraft(pair, "participantAId", event.target.value)}>
                  {options.map((participant) => <option key={participant.userId} value={participant.userId ?? ""}>{participant.nickname ?? participant.email}</option>)}
                </select>
                <label htmlFor={`pair-${pair.id}-b`}>参加者B</label>
                <select id={`pair-${pair.id}-b`} value={draft.participantBId} disabled={!editable} onChange={(event) => updatePairDraft(pair, "participantBId", event.target.value)}>
                  {options.filter((participant) => participant.userId !== draft.participantAId).map((participant) => <option key={participant.userId} value={participant.userId ?? ""}>{participant.nickname ?? participant.email}</option>)}
                </select>
                <label htmlFor={`pair-${pair.id}-url`}>Setlog URL</label>
                <input id={`pair-${pair.id}-url`} type="url" value={draft.setlogUrl} disabled={!editable} onChange={(event) => updatePairDraft(pair, "setlogUrl", event.target.value)} />
                <label htmlFor={`pair-${pair.id}-code`}>参加コード</label>
                <input id={`pair-${pair.id}-code`} type="text" value={draft.setlogCode} disabled={!editable} onChange={(event) => updatePairDraft(pair, "setlogCode", event.target.value)} />
                <div className="admin-pair__actions">
                  {editable && <button className="secondary-button" type="button" onClick={() => void updatePair(pair.id, "update", draft)}>変更を保存</button>}
                  <button className="secondary-button" type="button" onClick={() => void updatePair(pair.id, pair.status === "published" ? "unpublish" : "publish", draft)}>{pair.status === "published" ? "非公開にする" : "公開する"}</button>
                  {pair.status !== "closed" && <button className="text-button" type="button" onClick={() => void updatePair(pair.id, "close", draft)}>終了</button>}
                </div>
              </div>
            </article>
          );
        })}</div>
      </section>

      <section className="admin-card">
        <div className="admin-card__heading"><div><span className="label">直近90日</span><h2>登録ファネル</h2></div></div>
        <div className="admin-metric-summary"><div><strong>{metrics.totals.qualifiedVisits ?? 0}</strong><span>訪問</span></div><div><strong>{metrics.totals.emailVerified ?? 0}</strong><span>認証完了</span></div><div><strong>{metrics.totals.lineFollowed ?? 0}</strong><span>LINE追加</span></div><div><strong>{metrics.totals.registrationsCompleted ?? 0}</strong><span>登録完了</span></div></div>
        <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">紹介元別の登録ファネル</caption><thead><tr><th>紹介元</th><th>訪問</th><th>コード</th><th>認証</th><th>LINE</th><th>登録</th></tr></thead><tbody>{metrics.sources.length === 0 ? <tr><td colSpan={6}>まだ計測データがありません。</td></tr> : metrics.sources.map((source) => <tr key={`${source.refCode}-${source.utmSource}-${source.utmCampaign}`}><td><strong>{source.refCode}</strong><small>{source.utmSource || "direct"} / {source.utmCampaign || "—"}</small></td><td>{source.qualifiedVisits}</td><td>{source.authCodeRequests}</td><td>{source.emailVerified}</td><td>{source.lineFollowed}</td><td>{source.registrationsCompleted}</td></tr>)}</tbody></table></div>
      </section>

      <section className="admin-card">
        <div className="admin-card__heading"><div><span className="label">Safety</span><h2>通報</h2></div></div>
        {reports.length === 0 ? <p>通報はありません。</p> : <div className="admin-report-list">{reports.map((report) => <article className="admin-report" key={report.id}><strong>{report.reason}</strong><span>{report.status}</span><p>{report.detail ?? "詳細なし"}</p><small>{new Date(report.createdAt).toLocaleString("ja-JP")}</small><label htmlFor={`report-${report.id}-note`}>運営メモ</label><textarea id={`report-${report.id}-note`} value={reportNotes[report.id] ?? ""} maxLength={1000} onChange={(event) => setReportNotes((previous) => ({ ...previous, [report.id]: event.target.value }))} /><div className="admin-report__actions"><button className="secondary-button" type="button" onClick={() => void updateReport(report.id, "reviewed")}>確認済み</button><button className="primary-button" type="button" onClick={() => void updateReport(report.id, "resolved")}>解決済み</button>{report.status !== "open" && <button className="text-button" type="button" onClick={() => void updateReport(report.id, "open")}>未対応へ戻す</button>}</div></article>)}</div>}
      </section>
    </main>
  );
}
