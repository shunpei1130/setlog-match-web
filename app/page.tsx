"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { isLocalTestBrowser } from "../lib/local-test";
import { isAoyamaStudentEmail, normalizeAoyamaEmail } from "../lib/school-email";

type AppPhase =
  | "landing"
  | "participation"
  | "waiting"
  | "recommendation"
  | "ranking"
  | "dayPair"
  | "setlog"
  | "decision"
  | "result"
  | "ended";

type DecisionOption = "instagram" | "line" | "continue" | "none";
type PairStatus = "active" | "ended" | "blocked";
type SetlogStatus = "idle" | "connecting" | "connected" | "error";
type LineRegistrationStatus = "not_started" | "registered";
type LineRegistrationSource = "none" | "line_mock" | "local_test";
type WaitingCountState = {
  status: "loading" | "ready" | "error";
  count: number | null;
  capacity: number | null;
  remaining: number | null;
  updatedAt?: string;
};

type UserProfile = {
  displayName: string;
  year: string;
  campus: string;
  purpose: string;
  interests: string[];
};

type PrivateDecision = {
  instagram: boolean;
  line: boolean;
  continue: boolean;
  none: boolean;
  answered: boolean;
};

type Candidate = {
  id: string;
  displayName: string;
  initials: string;
  year: string;
  campus: string;
  interests: string[];
  weekend: string;
  color: string;
  partnerWants: DecisionOption[];
};

type DayPair = {
  candidateId: string;
  status: PairStatus;
  endedReason?: "decision" | "blocked" | "reported";
};

type ResultState = {
  kind: "disclosed" | "continued" | "ended";
  items: DecisionOption[];
};

type StoredState = {
  phase: AppPhase;
  participation: boolean;
  matchingStarted: boolean;
  eventKey: string;
  lineRegistration: {
    status: LineRegistrationStatus;
    source: LineRegistrationSource;
    reminderScheduled: boolean;
  };
  consent: {
    age: boolean;
    rules: boolean;
  };
  profile: UserProfile;
  rankByCandidate: Record<string, number>;
  pair: DayPair | null;
  setlogStatus: SetlogStatus;
  decision: PrivateDecision;
  result: ResultState | null;
  notice: string | null;
};

type SetlogAdapter = {
  createConnection: (pairId: string) => Promise<{ status: "connected"; roomLabel: string }>;
  getStatus: (pairId: string) => Promise<SetlogStatus>;
  endConnection: (pairId: string) => Promise<void>;
};

type LineAdapter = {
  startRegistration: () => Promise<void>;
  scheduleReminder: (eventKey: string) => Promise<void>;
};

const STORAGE_KEY = "setlog-match-mvp-state-v3";
const DEMO_EVENT_KEY = "next-saturday";

const candidates: Candidate[] = [
  {
    id: "candidate-aoi",
    displayName: "あおい",
    initials: "AO",
    year: "3年",
    campus: "青山キャンパス",
    interests: ["写真", "喫茶店", "映画"],
    weekend: "午前はカフェ、午後はフィルムカメラで街を歩くことが多い。",
    color: "coral",
    partnerWants: ["instagram"],
  },
  {
    id: "candidate-mei",
    displayName: "めい",
    initials: "ME",
    year: "2年",
    campus: "青山キャンパス",
    interests: ["音楽", "古着", "散歩"],
    weekend: "お気に入りのプレイリストを聴きながら、気になるお店を巡る。",
    color: "sage",
    partnerWants: ["continue"],
  },
  {
    id: "candidate-rin",
    displayName: "りん",
    initials: "RI",
    year: "4年",
    campus: "相模原キャンパス",
    interests: ["ランニング", "本", "コーヒー"],
    weekend: "朝に走って、午後は本屋か静かな場所で過ごす。",
    color: "lavender",
    partnerWants: ["none"],
  },
];

const initialProfile: UserProfile = {
  displayName: "ゆうき",
  year: "2年",
  campus: "青山キャンパス",
  purpose: "まずは一日の過ごし方を知りたい",
  interests: ["カフェ", "音楽", "散歩"],
};

const createInitialState = (): StoredState => ({
  phase: "landing",
  participation: false,
  matchingStarted: false,
  eventKey: DEMO_EVENT_KEY,
  lineRegistration: {
    status: "not_started",
    source: "none",
    reminderScheduled: false,
  },
  consent: { age: false, rules: false },
  profile: initialProfile,
  rankByCandidate: {},
  pair: null,
  setlogStatus: "idle",
  decision: {
    instagram: false,
    line: false,
    continue: false,
    none: false,
    answered: false,
  },
  result: null,
  notice: null,
});

const mockSetlogAdapter: SetlogAdapter = {
  createConnection: async (pairId) => {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return { status: "connected", roomLabel: `setlog-day-${pairId}` };
  },
  getStatus: async () => "connected",
  endConnection: async () => undefined,
};

const mockLineAdapter: LineAdapter = {
  startRegistration: async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
  },
  scheduleReminder: async () => undefined,
};

const phaseStep: Record<AppPhase, number> = {
  landing: 0,
  participation: 0,
  waiting: 1,
  recommendation: 2,
  ranking: 3,
  dayPair: 4,
  setlog: 4,
  decision: 5,
  result: 6,
  ended: 6,
};

const phaseLabels = ["事前登録", "土曜開始", "候補を見る", "希望順位", "Day Pair", "一日の終わり", "結果"];

const optionLabels: Record<DecisionOption, string> = {
  instagram: "Instagram",
  line: "LINE",
  continue: "もう一日Setlogする",
  none: "何も教えない",
};

function resolveResult(decision: PrivateDecision, candidate: Candidate): ResultState {
  if (!decision.answered || decision.none || candidate.partnerWants.includes("none")) {
    return { kind: "ended", items: [] };
  }

  const selected: DecisionOption[] = [
    decision.instagram ? "instagram" : null,
    decision.line ? "line" : null,
    decision.continue ? "continue" : null,
  ].filter((item): item is DecisionOption => item !== null);
  const items = selected.filter((item) => candidate.partnerWants.includes(item));

  if (items.length === 0) return { kind: "ended", items: [] };
  if (items.length === 1 && items[0] === "continue") return { kind: "continued", items };
  return { kind: "disclosed", items };
}

export default function Home() {
  const [state, setState] = useState<StoredState>(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [safetyError, setSafetyError] = useState("");
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineConnecting, setLineConnecting] = useState(false);
  const [participationSubmitting, setParticipationSubmitting] = useState(false);
  const [waitingCount, setWaitingCount] = useState<WaitingCountState>({
    status: "loading",
    count: null,
    capacity: null,
    remaining: null,
  });
  const [schoolEmail, setSchoolEmail] = useState("");
  const localTest = hydrated && isLocalTestBrowser();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<StoredState>;
        const initial = createInitialState();
        const storedLineRegistration = parsed.lineRegistration;
        const source = storedLineRegistration?.source
          ?? (storedLineRegistration?.status === "registered" ? "line_mock" : "none");
        startTransition(() => setState({
          ...initial,
          ...parsed,
          lineRegistration: {
            ...initial.lineRegistration,
            ...storedLineRegistration,
            source,
          },
        }));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    // Browser storage is intentionally read after hydration to avoid SSR/client markup drift.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    const scrollReset = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, 50);
    return () => window.clearTimeout(scrollReset);
  }, [hydrated, state.phase]);

  useEffect(() => {
    let cancelled = false;

    const refreshWaitingCount = async () => {
      setWaitingCount((previous) => ({ ...previous, status: previous.count === null ? "loading" : previous.status }));
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(state.eventKey)}/waiting-count`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Waiting count unavailable");
        const payload = await response.json() as {
          count?: unknown;
          capacity?: unknown;
          remaining?: unknown;
          updatedAt?: string;
        };
        if (
          typeof payload.count !== "number" || !Number.isInteger(payload.count) || payload.count < 0
          || typeof payload.capacity !== "number" || !Number.isInteger(payload.capacity) || payload.capacity <= 0
          || typeof payload.remaining !== "number" || !Number.isInteger(payload.remaining) || payload.remaining < 0
          || payload.remaining !== Math.max(0, payload.capacity - payload.count)
        ) {
          throw new Error("Invalid waiting count");
        }
        if (!cancelled) {
          setWaitingCount({
            status: "ready",
            count: payload.count,
            capacity: payload.capacity,
            remaining: payload.remaining,
            updatedAt: payload.updatedAt,
          });
        }
      } catch {
        if (!cancelled) setWaitingCount((previous) => ({ ...previous, status: "error" }));
      }
    };

    void refreshWaitingCount();
    const interval = window.setInterval(() => void refreshWaitingCount(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [state.eventKey]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === state.pair?.candidateId) ?? null,
    [state.pair],
  );
  const currentStep = phaseStep[state.phase];
  const rankedCandidates = Object.entries(state.rankByCandidate).sort(([, a], [, b]) => a - b);

  const updateState = (updates: Partial<StoredState>) => {
    setState((previous) => ({ ...previous, ...updates }));
  };

  const resetDemo = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The visual demo should still be reset when browser storage is unavailable.
    }
    setState(createInitialState());
    setSafetyOpen(false);
    setUtilityMenuOpen(false);
    setReportReason("");
    setReportDetail("");
    setSafetyError("");
    setLineModalOpen(false);
    setLineConnecting(false);
    setSchoolEmail("");
  };

  const handleParticipation = async () => {
    if (!state.consent.age || !state.consent.rules) {
      updateState({ notice: "年齢確認と安全ルールへの同意が必要です。" });
      return;
    }
    const normalizedSchoolEmail = normalizeAoyamaEmail(schoolEmail);
    if (!localTest && (!normalizedSchoolEmail || !isAoyamaStudentEmail(normalizedSchoolEmail))) {
      updateState({ notice: "青学のメールアドレス（@aoyama.jp または @aoyama.ac.jp）を入力してください。" });
      return;
    }
    if (!localTest && state.lineRegistration.status !== "registered") {
      updateState({ notice: "事前登録にはLINE登録が必要です。" });
      return;
    }
    const localTestRegistration = localTest;
    setParticipationSubmitting(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(state.eventKey)}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineRegistered: state.lineRegistration.source === "line_mock",
          lineTestBypass: localTestRegistration,
          schoolEmailTestBypass: localTestRegistration,
          ...(normalizedSchoolEmail ? { schoolEmail: normalizedSchoolEmail } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: unknown;
        count?: unknown;
        capacity?: unknown;
        remaining?: unknown;
        updatedAt?: string;
      } | null;
      if (response.status === 409 && payload?.error === "EVENT_FULL") {
        setWaitingCount((previous) => ({
          ...previous,
          status: "ready",
          count: typeof payload.count === "number" ? payload.count : previous.count,
          capacity: typeof payload.capacity === "number" ? payload.capacity : previous.capacity,
          remaining: 0,
        }));
        updateState({ notice: "初回募集は定員に達しました。今回は受付を終了しました。" });
        return;
      }
      if (!response.ok || !payload) throw new Error("Registration unavailable");
      if (
        typeof payload.count !== "number" || !Number.isInteger(payload.count) || payload.count < 0
        || typeof payload.capacity !== "number" || !Number.isInteger(payload.capacity) || payload.capacity <= 0
        || typeof payload.remaining !== "number" || !Number.isInteger(payload.remaining) || payload.remaining < 0
      ) {
        throw new Error("Invalid registration response");
      }
      setWaitingCount({
        status: "ready",
        count: payload.count,
        capacity: payload.capacity,
        remaining: payload.remaining,
        updatedAt: payload.updatedAt,
      });
      updateState({ participation: true, matchingStarted: false, phase: "waiting", notice: null });
    } catch {
      updateState({ notice: "事前登録を保存できませんでした。通信を確認して、もう一度お試しください。" });
    } finally {
      setParticipationSubmitting(false);
    }
  };

  const waitingCountText = waitingCount.status === "error"
    ? "人数を取得できません"
    : waitingCount.count !== null
      ? `現在${waitingCount.count}人`
      : "人数を確認中…";

  const remainingSlotsText = waitingCount.status === "error"
    ? "残り枠を取得できません"
    : waitingCount.remaining !== null
      ? `残り${waitingCount.remaining}枠`
      : "残り枠を確認中…";
  const eventIsFull = waitingCount.status === "ready" && waitingCount.remaining === 0;

  const completeLineRegistration = async () => {
    setLineConnecting(true);
    try {
      await mockLineAdapter.startRegistration();
      await mockLineAdapter.scheduleReminder(state.eventKey);
      updateState({
        lineRegistration: { status: "registered", source: "line_mock", reminderScheduled: true },
        notice: null,
      });
      setLineModalOpen(false);
    } catch {
      updateState({ notice: "LINE登録の準備に失敗しました。もう一度お試しください。" });
    } finally {
      setLineConnecting(false);
    }
  };

  const startLineRegistration = () => {
    updateState({ notice: null });
    setLineModalOpen(true);
  };

  const startMatching = () => {
    if (!state.participation) {
      updateState({ phase: "participation", notice: "先に次回土曜への事前登録を完了してください。" });
      return;
    }
    updateState({ matchingStarted: true, phase: "recommendation", notice: null });
  };

  const toggleRank = (candidateId: string, rank: number) => {
    setState((previous) => {
      const next = { ...previous.rankByCandidate };
      if (next[candidateId] === rank) {
        delete next[candidateId];
      } else {
        Object.entries(next).forEach(([id, existingRank]) => {
          if (existingRank === rank) delete next[id];
        });
        next[candidateId] = rank;
      }
      return { ...previous, rankByCandidate: next, notice: null };
    });
  };

  const confirmRanking = () => {
    const chosen = rankedCandidates[0]?.[0];
    if (!chosen) {
      updateState({ notice: "少なくとも1人、希望順位を選んでください。" });
      return;
    }
    updateState({
      phase: "dayPair",
      pair: { candidateId: chosen, status: "active" },
      setlogStatus: "idle",
      decision: createInitialState().decision,
      result: null,
      notice: null,
    });
  };

  const connectSetlog = async () => {
    if (!selectedCandidate) return;
    updateState({ setlogStatus: "connecting", notice: null });
    try {
      const connection = await mockSetlogAdapter.createConnection(selectedCandidate.id);
      updateState({ setlogStatus: connection.status, notice: null });
    } catch {
      updateState({ setlogStatus: "error", notice: "Setlogへの接続に失敗しました。もう一度試してください。" });
    }
  };

  const openDecision = () => updateState({ phase: "decision", notice: null });

  const toggleDecision = (option: DecisionOption) => {
    setState((previous) => {
      if (option === "none") {
        return {
          ...previous,
          decision: {
            instagram: false,
            line: false,
            continue: false,
            none: !previous.decision.none,
            answered: false,
          },
          notice: null,
        };
      }
      return {
        ...previous,
        decision: {
          ...previous.decision,
          [option]: !previous.decision[option],
          none: false,
          answered: false,
        },
        notice: null,
      };
    });
  };

  const confirmDecision = () => {
    if (!selectedCandidate) return;
    const { instagram, line, continue: continueChoice, none } = state.decision;
    if (!instagram && !line && !continueChoice && !none) {
      updateState({ notice: "いずれかを選ぶか、「何も教えない」を選択してください。" });
      return;
    }
    const decision = { ...state.decision, answered: true };
    const result = resolveResult(decision, selectedCandidate);
    updateState({
      phase: "result",
      decision,
      result,
      pair: state.pair ? { ...state.pair, status: "ended", endedReason: "decision" } : null,
      notice: null,
    });
  };

  const endForSafety = (reason: "blocked" | "reported") => {
    if (state.pair) void mockSetlogAdapter.endConnection(state.pair.candidateId);
    updateState({
      phase: "ended",
      pair: state.pair ? { ...state.pair, status: reason === "blocked" ? "blocked" : "ended", endedReason: reason } : null,
      setlogStatus: "idle",
      notice: reason === "blocked" ? "相手を非表示にしました。これ以上の通知は届きません。" : "通報を受け付けました。確認が終わるまで相手を非表示にします。",
    });
    setSafetyOpen(false);
    setSafetyError("");
  };

  const submitReport = () => {
    if (!reportReason) {
      setSafetyError("通報理由を選択してください。");
      return;
    }
    endForSafety("reported");
  };

  if (!hydrated) {
    return (
      <main className="loading-screen">
        <div className="brand-mark brand-mark--large">S</div>
        <p>土曜日を準備しています…</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Setlog Match">
          <span className="brand-mark">S</span>
          <span>
            <strong>setlog match</strong>
            <small>SATURDAY ISSUE / 001</small>
          </span>
        </div>
        <div className="utility-menu-wrap">
          <button
            className="menu-button"
            type="button"
            aria-label="メニューを開く"
            aria-expanded={utilityMenuOpen}
            onClick={() => setUtilityMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {utilityMenuOpen && (
            <div className="utility-menu" role="menu">
              {state.phase !== "landing" && (
                <button type="button" role="menuitem" onClick={() => { setUtilityMenuOpen(false); setSafetyOpen(true); }}>
                  安全メニュー
                </button>
              )}
              <button type="button" role="menuitem" onClick={resetDemo}>
                最初からやり直す
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {state.phase !== "landing" && (
          <div className="progress-panel" aria-label="参加の進行状況">
            <div className="progress-topline">
              <span>次回土曜 / 12:00</span>
              <span>{String(Math.min(currentStep + 1, phaseLabels.length)).padStart(2, "0")} / {String(phaseLabels.length).padStart(2, "0")}</span>
            </div>
            <div className="progress-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(8, (currentStep / (phaseLabels.length - 1)) * 100)}%` }} />
            </div>
            <div className="progress-current">
              <strong>{phaseLabels[Math.min(currentStep, phaseLabels.length - 1)]}</strong>
              <span>{currentStep < phaseLabels.length - 1 ? `次は ${phaseLabels[currentStep + 1]}` : "参加完了"}</span>
            </div>
          </div>
        )}

        {state.notice && <div className="notice" role="status">{state.notice}</div>}

        {state.phase === "landing" && (
          <section className="landing-grid">
            <div className="hero-copy">
              <p className="eyebrow">SETLOG / SATURDAY ISSUE 001</p>
              <h1>青学の知らない人の一日、<em>見てみない？</em></h1>
              <p className="hero-lede">
                写真で選ぶ前に、その人の普通の土曜日を見る。Setlogで一日を共有して、夜にお互いの気持ちを静かに確かめます。
              </p>
              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={() => updateState({ phase: "participation", notice: null })}
                  disabled={eventIsFull && !state.participation}
                >
                  {eventIsFull && !state.participation ? "初回募集は満員です" : "次の土曜に事前登録する"} <span>↗</span>
                </button>
                <span className="micro-copy">初回100人限定 / 18歳以上 / 青学生限定</span>
              </div>
            </div>

            <div className="event-card">
              <div className="event-card__top">
                <span className="status-pill"><span className="status-dot" />{eventIsFull ? "受付終了" : "受付中"}</span>
                <span className="event-number">ISSUE 01</span>
              </div>
              <div className="date-lockup">
                <span>次回号</span>
                <strong>SAT</strong>
                <span>12:00 / 開場</span>
              </div>
              <div className="event-card__count" aria-live="polite">
                <span className="label">初回募集 / 100人限定</span>
                <strong>{remainingSlotsText}</strong>
                <small>{waitingCountText} / LINE登録済みの参加者</small>
              </div>
              <div className="event-card__bottom">
                <div>
                  <span className="label">土曜のDay Pair</span>
                  <strong>一日の共有から始まる出会い</strong>
                </div>
                <span className="arrow-badge">↗</span>
              </div>
            </div>

            <div className="principles-card">
              <span className="label">このアプリの流れ</span>
              <div className="principle-list">
                <div><span>01</span><strong>見る</strong><p>3人の土曜日を読む。</p></div>
                <div><span>02</span><strong>共有する</strong><p>自分の一日をSetlogする。</p></div>
                <div><span>03</span><strong>選ぶ</strong><p>夜に、静かに決める。</p></div>
              </div>
            </div>
          </section>
        )}

        {state.phase === "participation" && (
          <section className="page-section narrow-section">
            <p className="eyebrow">01 / 次回土曜の準備</p>
            <h2>次回土曜に、<br /><em>事前登録しておく。</em></h2>
            <p className="section-lede">登録はいつでもできます。参加枠を確保しておけば、土曜になったときにマッチングを開始できます。</p>
            <div className="detail-card profile-preview">
              <div className="avatar avatar--you">YU</div>
              <div><span className="label">あなたのプロフィール</span><strong>{state.profile.displayName} / {state.profile.year}</strong><p>{state.profile.purpose}</p></div>
              <span className="verified-badge">青学生 ✓</span>
            </div>
            {localTest ? (
              <div className="local-test-note" role="status">
                <span className="local-test-note__mark">LOCAL</span>
                <div><strong>ローカルテスト中</strong><p>青学メールとLINE登録を省略して、参加フローを確認できます。</p></div>
              </div>
            ) : (
              <div className="school-email-field">
                <label htmlFor="school-email">青学のメールアドレス</label>
                <input
                  id="school-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={schoolEmail}
                  required
                  onChange={(event) => {
                    setSchoolEmail(event.target.value);
                    if (state.notice) updateState({ notice: null });
                  }}
                  placeholder="yourname@aoyama.jp"
                  aria-describedby="school-email-help"
                />
                <small id="school-email-help">@aoyama.jp または @aoyama.ac.jp のメールアドレスが必要です。入力内容はDBへ保存しません。</small>
              </div>
            )}
            <div className="check-list">
              <label className={`check-row ${state.consent.age ? "is-checked" : ""}`}>
                <input type="checkbox" checked={state.consent.age} onChange={(event) => updateState({ consent: { ...state.consent, age: event.target.checked }, notice: null })} />
                <span className="fake-check">✓</span>
                <span><strong>18歳以上であることを確認します</strong><small>初期版は18歳以上の青学生を対象にしています。</small></span>
              </label>
              <label className={`check-row ${state.consent.rules ? "is-checked" : ""}`}>
                <input type="checkbox" checked={state.consent.rules} onChange={(event) => updateState({ consent: { ...state.consent, rules: event.target.checked }, notice: null })} />
                <span className="fake-check">✓</span>
                <span><strong>安全ルールに同意します</strong><small>嫌なことは断ってよい。いつでもブロック・通報できます。</small></span>
              </label>
            </div>
            {!localTest && <div className={`line-setup-card ${state.lineRegistration.status === "registered" ? "is-registered" : ""}`}>
              <div className="line-setup-card__icon">LINE</div>
              <div className="line-setup-card__body">
                <span className="label">参加に必要です</span>
                <strong>{state.lineRegistration.status === "registered" ? "LINE登録済み" : "LINEを登録して、金曜の案内を受け取る"}</strong>
                <p>{state.lineRegistration.status === "registered" ? "金曜21:00に「明日はマッチング！」の案内を送る予定です。" : "金曜21:00に参加アンケートをお送りします。"}</p>
              </div>
              {state.lineRegistration.status === "registered" && <span className="line-setup-card__check">✓</span>}
            </div>}
            <button className="primary-button full-width" onClick={localTest || state.lineRegistration.status === "registered" ? handleParticipation : startLineRegistration} disabled={participationSubmitting}>
              {participationSubmitting ? "事前登録を保存中…" : localTest ? "テスト参加を開始する" : state.lineRegistration.status === "registered" ? "参加登録を完了する" : "LINE登録を始める"} <span>→</span>
            </button>
          </section>
        )}

        {state.phase === "waiting" && (
          <section className="page-section narrow-section waiting-section">
            <p className="eyebrow">02 / 土曜を待つ</p>
            <h2>事前登録が、<br /><em>完了しました。</em></h2>
            <p className="section-lede">次回土曜の参加枠を確保しています。候補者と希望順位は、土曜のマッチング開始後に表示されます。</p>
            <div className="waiting-card">
              <div className="waiting-card__top"><span className="status-pill status-pill--light"><span className="status-dot" />事前登録済み</span><span className="event-number">NEXT SATURDAY</span></div>
              <div className="waiting-card__date"><span>毎週土曜</span><strong>12:00</strong><small>マッチング開始</small></div>
              <div className="waiting-card__copy"><strong>土曜になったら、ここから開始</strong><p>開始ボタンを押すまで、候補者や相手の情報は表示されません。</p></div>
              <div className="waiting-card__line"><span className="line-badge">LINE</span><div><strong>金曜21:00の案内を予約済み</strong><p>「明日はマッチング！」と参加アンケートをLINEでお送りします。</p></div></div>
              <div className="waiting-card__count" aria-live="polite"><span className="label">初回募集 / 100人限定</span><strong>{remainingSlotsText}</strong><p>{waitingCountText}。次回土曜に参加予定の青学生です。</p></div>
            </div>
            <button className="primary-button full-width" onClick={startMatching}>土曜のマッチングを開始する <span>→</span></button>
            <p className="waiting-note">デモ版では曜日に関係なく、開始ボタンで土曜の状態を再現できます。</p>
          </section>
        )}

        {state.phase === "recommendation" && (
          <section className="page-section">
            <div className="section-heading-row"><div><p className="eyebrow">03 / 今日届いた3つの一日</p><h2>今日の候補は、<em>この3人。</em></h2></div><span className="count-note">青学生 / 本人確認済み</span></div>
            <p className="section-lede">プロフィールを読んで、気になる順番をつけます。相手にあなたの順位が伝わることはありません。</p>
            <div className="candidate-grid">
              {candidates.map((candidate, index) => (
                <article className="candidate-card" key={candidate.id}>
                  <div className={`candidate-avatar avatar--${candidate.color}`}><span>{candidate.initials}</span><small>0{index + 1}</small></div>
                  <div className="candidate-info"><div className="candidate-name"><h3>{candidate.displayName}</h3><span>{candidate.year}</span></div><p className="candidate-meta">{candidate.campus}</p><div className="tag-list">{candidate.interests.map((interest) => <span key={interest}>{interest}</span>)}</div><p className="candidate-weekend">{candidate.weekend}</p></div>
                </article>
              ))}
            </div>
            <div className="section-footer"><span>候補者の順位は相手に表示されません。</span><button className="primary-button" onClick={() => updateState({ phase: "ranking", notice: null })}>希望順位を入力する <span>→</span></button></div>
          </section>
        )}

        {state.phase === "ranking" && (
          <section className="page-section">
            <div className="section-heading-row"><div><p className="eyebrow">04 / あなたの内緒の順位</p><h2>気になる順番を、<em>静かに。</em></h2></div><span className="count-note">最大3人 / 1人からOK</span></div>
            <p className="section-lede">選んだ順位は、マッチングのためだけに使います。「第3希望だった」と相手に伝わることはありません。</p>
            <div className="ranking-layout">
              <div className="ranking-list">
                {candidates.map((candidate) => {
                  const rank = state.rankByCandidate[candidate.id];
                  return <article className={`ranking-card ${rank ? "is-ranked" : ""}`} key={candidate.id}><div className={`mini-avatar avatar--${candidate.color}`}>{candidate.initials}</div><div className="ranking-card__body"><div><strong>{candidate.displayName}</strong><span>{candidate.year} / {candidate.campus}</span></div><div className="rank-buttons" aria-label={`${candidate.displayName}の希望順位`}><button className={rank === 1 ? "selected" : ""} onClick={() => toggleRank(candidate.id, 1)} aria-label={`${candidate.displayName}を第1希望にする`}>1</button><button className={rank === 2 ? "selected" : ""} onClick={() => toggleRank(candidate.id, 2)} aria-label={`${candidate.displayName}を第2希望にする`}>2</button><button className={rank === 3 ? "selected" : ""} onClick={() => toggleRank(candidate.id, 3)} aria-label={`${candidate.displayName}を第3希望にする`}>3</button></div></div></article>;
                })}
              </div>
              <aside className="rank-summary"><span className="label">あなたの希望順位</span><div className="rank-summary__list">{[1, 2, 3].map((rank) => { const entry = rankedCandidates.find(([, value]) => value === rank); const candidate = candidates.find((item) => item.id === entry?.[0]); return <div className="summary-row" key={rank}><span className="rank-circle">{rank}</span><span>{candidate?.displayName ?? "まだ選択していません"}</span></div>; })}</div><p>第1希望から順に、条件が合う相手とDay Pairになります。</p><button className="primary-button full-width" onClick={confirmRanking}>この順位で確定する <span>→</span></button></aside>
            </div>
          </section>
        )}

        {state.phase === "dayPair" && selectedCandidate && (
          <section className="page-section pair-section">
            <p className="eyebrow">05 / 今日のDay Pair</p>
            <div className="pair-intro"><div><h2>今日の相手は、<br /><em>{selectedCandidate.displayName}さん。</em></h2><p>お互いの条件が合ったため、本日のDay Pairになりました。</p></div><div className={`pair-avatar avatar--${selectedCandidate.color}`}><span>{selectedCandidate.initials}</span><i>●</i></div></div>
            <div className="pair-timeline"><div className="timeline-item is-done"><span>12:00</span><div><strong>Day Pair成立</strong><p>相手に会えたことだけをお知らせしています。</p></div></div><div className="timeline-item is-current"><span>12:00 — 22:00</span><div><strong>Setlogで一日を共有</strong><p>連絡先はまだ聞かない。今日の普通を見せ合う時間です。</p></div></div><div className="timeline-item"><span>22:00</span><div><strong>非公開判定</strong><p>続けたいものを、アプリだけで選びます。</p></div></div></div>
            <div className="rule-callout"><span>✳</span><p><strong>このDay Pairは本日23時に終了します。</strong><br />続けるかどうかは、夜にお互いが非公開で選択します。</p></div>
            <div className="pair-actions"><button className="primary-button full-width" onClick={() => updateState({ phase: "setlog", notice: null })}>Setlogにつなぐ <span>↗</span></button></div>
          </section>
        )}

        {state.phase === "setlog" && selectedCandidate && (
          <section className="page-section narrow-section">
            <p className="eyebrow">05 / Setlogにつなぐ</p>
            <h2>今日は、<em>一日の共有から。</em></h2>
            <p className="section-lede">Setlogでお互いの土曜日を共有します。連絡先交換の話は、夜の判定までしなくて大丈夫です。</p>
            <div className="setlog-card"><div className="setlog-card__head"><div className="setlog-logo">setlog<span>↗</span></div><span className="status-pill status-pill--light">Day Pairの部屋</span></div><div className="setlog-room"><div className={`pair-avatar avatar--${selectedCandidate.color}`}><span>{selectedCandidate.initials}</span></div><div><span className="label">今日の共有ルーム</span><strong>あなた × {selectedCandidate.displayName}さん</strong><p>12:00 — 22:00 / 一日のログ</p></div></div>{state.setlogStatus === "connected" ? <div className="connected-message"><span>✓</span><div><strong>Setlogの準備ができました</strong><p>今日は一日を楽しんでください。22時にここへ戻ってきます。</p></div></div> : state.setlogStatus === "error" ? <div className="error-message"><strong>接続できませんでした</strong><p>通信を確認して、もう一度試してください。</p></div> : <div className="setlog-card__action"><p>接続はデモモードで行われます。実際のSetlogは開きません。</p><button className="primary-button" onClick={connectSetlog} disabled={state.setlogStatus === "connecting"}>{state.setlogStatus === "connecting" ? "接続中…" : "Setlogを準備する"}<span>↗</span></button></div>}</div>
            {state.setlogStatus === "connected" && <><div className="setlog-next"><div><span className="label">NEXT</span><strong>22時に判定画面が開きます</strong><p>Instagram、LINE、もう一日、何も教えない。答えは相手には見えません。</p></div></div><button className="primary-button full-width" onClick={openDecision}>夜の判定へ進む <span>→</span></button></>}
            {state.setlogStatus === "error" && <button className="primary-button full-width" onClick={connectSetlog}>もう一度接続する <span>↻</span></button>}
          </section>
        )}

        {state.phase === "decision" && selectedCandidate && (
          <section className="page-section narrow-section decision-section">
            <div className="decision-top"><div><p className="eyebrow">06 / 夜の内緒の判定</p><h2>今日の相手に、<br /><em>何を教える？</em></h2></div><div className="decision-time"><strong>22:00</strong><span>回答受付中</span></div></div>
            <p className="section-lede">選択内容は相手に見えません。お互いが選んだものだけ、23時に開示されます。</p>
            <div className="decision-options">{(["instagram", "line", "continue", "none"] as DecisionOption[]).map((option) => <button key={option} className={`decision-option ${state.decision[option] ? "is-selected" : ""} ${option === "none" ? "is-muted" : ""}`} onClick={() => toggleDecision(option)} aria-pressed={state.decision[option]}><span className="decision-icon">{option === "instagram" ? "◎" : option === "line" ? "▣" : option === "continue" ? "↻" : "—"}</span><span><strong>{optionLabels[option]}</strong><small>{option === "instagram" ? "お互いに選んだら開示" : option === "line" ? "お互いに選んだら開示" : option === "continue" ? "次回、もう一日だけ共有" : "相手には何も伝えない"}</small></span><span className="select-mark">{state.decision[option] ? "✓" : "＋"}</span></button>)}</div>
            <div className="privacy-note"><span>非公開</span><p>相手の回答内容、片方だけが希望した事実、希望順位は表示されません。</p></div>
            <button className="primary-button full-width" onClick={confirmDecision}>この内容で送信する <span>→</span></button>
          </section>
        )}

        {state.phase === "result" && selectedCandidate && state.result && (
          <section className="page-section result-section">
            <div className="result-stamp">23:00 / 結果</div>
            {state.result.kind === "disclosed" && <><p className="eyebrow">07 / 一致したもの</p><h2>一致したものだけ、<br /><em>開きました。</em></h2><p className="section-lede">{selectedCandidate.displayName}さんと、次の連絡先が一致しました。ここからは二人のペースで。</p><div className="disclosed-list">{state.result.items.map((item) => <div className="disclosed-item" key={item}><span className="disclosed-icon">{item === "instagram" ? "◎" : "▣"}</span><strong>{optionLabels[item]}</strong><span className="disclosed-check">双方一致 ✓</span></div>)}</div></>}
            {state.result.kind === "continued" && <><p className="eyebrow">07 / もう一日</p><h2>もう一日だけ、<br /><em>続けてみる。</em></h2><p className="section-lede">連絡先を交換する前に、もう一度だけSetlogで一日を共有します。次回開催の案内をお送りします。</p><div className="result-note result-note--sage"><span>↻</span><div><strong>次回のDay Pair候補にしました</strong><p>相手には、あなたの回答内容は表示されません。</p></div></div></>}
            {state.result.kind === "ended" && <><p className="eyebrow">07 / Day Pair完了</p><h2>今回のDay Pairは、<br /><em>ここで終了です。</em></h2><p className="section-lede">ご参加ありがとうございました。相手の選択内容や不成立の理由は、お互いに表示されません。</p><div className="result-note"><span>○</span><div><strong>後腐れなく、今日はここまで</strong><p>独自アプリ上では相手を再推薦しません。</p></div></div></>}
            <div className="result-footer"><button className="primary-button full-width" onClick={resetDemo}>次の土曜を見る <span>→</span></button><span>また参加したくなったら、いつでも戻ってきてください。</span></div>
          </section>
        )}

        {state.phase === "ended" && (
          <section className="page-section narrow-section result-section"><div className="result-stamp">DAY PAIR / CLOSED</div><p className="eyebrow">Safety first</p><h2>接続を、<br /><em>終了しました。</em></h2><p className="section-lede">{state.notice ?? "このDay Pairは終了しました。相手の情報はこれ以上表示されません。"}</p><div className="result-note"><span>✓</span><div><strong>あなたの判断を尊重します</strong><p>再推薦と通知は停止されています。</p></div></div><button className="primary-button full-width" onClick={resetDemo}>最初の画面へ <span>→</span></button></section>
        )}
      </main>

      <footer className="app-footer"><span>setlog match / SATURDAY ISSUE 001</span><span>青学生限定のデモ版。実際の個人情報は扱いません。</span></footer>

      {safetyOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSafetyOpen(false)}>
          <section className="safety-modal" role="dialog" aria-modal="true" aria-labelledby="safety-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top"><div><span className="eyebrow">安全メニュー</span><h2 id="safety-title">困ったときは、<br /><em>すぐに離れて大丈夫。</em></h2></div><button className="close-button" onClick={() => setSafetyOpen(false)} aria-label="安全メニューを閉じる">×</button></div>
            <p>返信をしなくても、理由を説明しなくても大丈夫です。ブロックすると相手を非表示にし、通報すると運営に共有します。</p>
            <div className="safety-actions"><button className="danger-button" onClick={() => endForSafety("blocked")}>相手をブロックする</button><div className="report-box"><label htmlFor="report-reason">通報理由</label><select id="report-reason" value={reportReason} onChange={(event) => { setReportReason(event.target.value); setSafetyError(""); }}><option value="">選択してください</option><option value="harassment">不快な言動・嫌がらせ</option><option value="identity">プロフィールや所属が不自然</option><option value="solicitation">勧誘・金銭の要求</option><option value="other">その他</option></select><label htmlFor="report-detail">補足（任意）</label><textarea id="report-detail" value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} placeholder="気になったことがあれば書いてください" rows={3} />{safetyError && <p className="field-error" role="alert">{safetyError}</p>}<button className="secondary-button full-width" onClick={submitReport}>運営に通報する <span>→</span></button></div></div>
          </section>
        </div>
      )}

      {lineModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setLineModalOpen(false)}>
          <section className="line-modal" role="dialog" aria-modal="true" aria-labelledby="line-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top"><span className="line-modal__mark">LINE</span><button className="close-button" onClick={() => setLineModalOpen(false)} aria-label="LINE登録を閉じる">×</button></div>
            <p className="eyebrow">LINE登録</p>
            <h2 id="line-modal-title">前日の案内を、<br /><em>LINEで受け取る。</em></h2>
            <p>事前登録にはLINE登録が必要です。金曜21:00に、翌日のマッチングに参加するかを確認するアンケートをお送りします。</p>
            <div className="line-modal__preview"><span>金曜 21:00</span><strong>明日はマッチング！</strong><small>参加する / 今回は見送る</small></div>
            <button className="primary-button full-width" type="button" onClick={completeLineRegistration} disabled={lineConnecting}>{lineConnecting ? "LINE登録を準備中…" : "LINE登録を完了する"}<span>→</span></button>
          </section>
        </div>
      )}
    </div>
  );
}
