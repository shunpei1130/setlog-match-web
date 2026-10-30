"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import LiveParticipation from "./live-participation";
import type { EventState } from "../ios/src/types";
import { isLocalTestBrowser } from "../lib/local-test";
import {
  PROFILE_GENDERS,
  PROFILE_YEARS,
  GENDER_PREFERENCES,
  MATCH_PURPOSES,
  type ContactField,
  type PreferenceField,
  type ProfileField,
  type RegistrationProfile,
  validateContactHandles,
  validateRegistrationPreferences,
  validateRegistrationProfile,
} from "../lib/profile";
import { normalizeEmailAddress } from "../lib/school-email";

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
type LineRegistrationSource = "none" | "line_mock" | "line_live" | "local_test";
type WaitingCountState = {
  status: "loading" | "ready" | "error";
  count: number | null;
  capacity: number | null;
  remaining: number | null;
  updatedAt?: string;
  startsAt?: string;
  decisionOpensAt?: string;
  registrationOpen?: boolean;
  canCancel?: boolean;
  decisionOpen?: boolean;
};

type UserProfile = {
  nickname: string;
  faculty: string;
  year: string;
  gender: string;
  instagramHandle: string;
  lineContact: string;
  campus: string;
  purpose: string;
  preferredGender: string;
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
  faculty?: string;
  gender?: string;
};

type DayPair = {
  candidateId: string;
  pairId?: string;
  status: PairStatus;
  endedReason?: "decision" | "blocked" | "reported";
};

type ResultState = {
  kind: "pending" | "disclosed" | "continued" | "ended";
  items: DecisionOption[];
  contacts?: { instagram?: string; line?: string } | null;
};

type RemotePair = {
  id: string;
  eventKey: string;
  startsAt: string;
  decisionOpensAt: string;
  decisionOpen: boolean;
  status: "draft" | "published" | "closed" | "blocked";
  setlogUrl: string | null;
  setlogCode: string | null;
  candidate: {
    id: string;
    nickname: string;
    faculty: string;
    academicYear: string;
    gender: string;
  };
  decision: (PrivateDecision & { answered: boolean }) | null;
  partnerAnswered: boolean;
  result: ResultState | null;
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

const STORAGE_KEY = "set-mob-state-v1";
const LEGACY_STORAGE_KEYS = ["setlog-match-mvp-state-v4"] as const;
const DEMO_EVENT_KEY = "next-saturday";

const profileFieldLabels: Record<ProfileField, string> = {
  nickname: "ニックネーム",
  faculty: "学部",
  academicYear: "学年",
  gender: "性別",
};

const profileGenderLabels: Record<RegistrationProfile["gender"], string> = {
  male: "男性",
  female: "女性",
  other: "その他",
};

const matchPurposeLabels = {
  friend: "友人として知り合いたい",
  romance: "恋愛を前提に知り合いたい",
  either: "どちらでも",
} as const;

const genderPreferenceLabels = {
  any: "問わない",
  male: "男性",
  female: "女性",
  other: "その他",
} as const;

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
  nickname: "",
  faculty: "",
  year: "",
  gender: "",
  instagramHandle: "",
  lineContact: "",
  campus: "",
  purpose: "",
  preferredGender: "any",
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

const demoPhaseStep: Record<AppPhase, number> = {
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

const livePhaseStep: Record<AppPhase, number> = {
  landing: 0,
  participation: 0,
  waiting: 1,
  recommendation: 2,
  ranking: 2,
  dayPair: 2,
  setlog: 3,
  decision: 4,
  result: 5,
  ended: 5,
};

const demoPhaseLabels = ["参加登録", "開始を待つ", "候補を見る", "希望順位", "今日の相手", "今日の振り返り", "結果を確認"];
const livePhaseLabels = ["参加登録", "開始を待つ", "今日の相手", "Setlogで共有", "今日の振り返り", "結果を確認"];

const optionLabels: Record<DecisionOption, string> = {
  instagram: "Instagramを交換したい",
  line: "LINEを交換したい",
  continue: "明日（日曜）も続けたい",
  none: "今回はここで終える",
};

function resolveResult(decision: PrivateDecision, candidate: Candidate): ResultState {
  if (!decision.answered || decision.none || candidate.partnerWants.includes("none")) {
    return { kind: "ended", items: [] };
  }

  if (decision.continue || candidate.partnerWants.includes("continue")) {
    return decision.continue && candidate.partnerWants.includes("continue")
      ? { kind: "continued", items: ["continue"] }
      : { kind: "ended", items: [] };
  }

  const selected: DecisionOption[] = [
    decision.instagram ? "instagram" : null,
    decision.line ? "line" : null,
    decision.continue ? "continue" : null,
  ].filter((item): item is DecisionOption => item !== null);
  const items = selected.filter((item) => candidate.partnerWants.includes(item));

  if (items.length === 0) return { kind: "ended", items: [] };
  return { kind: "disclosed", items };
}

function disclosedContact(result: ResultState, item: DecisionOption) {
  if (item !== "instagram" && item !== "line") return undefined;
  return result.contacts?.[item];
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
  const [lineLinkDetail, setLineLinkDetail] = useState<{ linked: boolean; followed: boolean } | null>(null);
  const [lineRechecking, setLineRechecking] = useState(false);
  const [participationSubmitting, setParticipationSubmitting] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [preferenceErrors, setPreferenceErrors] = useState<Partial<Record<PreferenceField, string>>>({});
  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [waitingCount, setWaitingCount] = useState<WaitingCountState>({
    status: "loading",
    count: null,
    capacity: null,
    remaining: null,
  });
  const [schoolEmail, setSchoolEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authCodeSent, setAuthCodeSent] = useState(false);
  const [authSending, setAuthSending] = useState(false);
  const [authVerifying, setAuthVerifying] = useState(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [lineOfficialAccountUrl, setLineOfficialAccountUrl] = useState<string | null>(null);
  const [remotePair, setRemotePair] = useState<RemotePair | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const localTest = hydrated && isLocalTestBrowser() && !new URLSearchParams(window.location.search).has("live");
  const liveParticipationActive = !localTest && Boolean(authenticatedEmail) && state.participation;
  const liveRegister = useCallback((eventKey: string) => setState((previous) => ({ ...previous, eventKey, participation: false, phase: "participation", pair: null, result: null })), []);
  const liveExpired = useCallback(() => { setAuthenticatedEmail(null); setState((previous) => ({ ...previous, participation: false, phase: "participation", notice: "もう一度メール認証してください。" })); }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
      ?? LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<StoredState>;
        const initial = createInitialState();
        const storedLineRegistration = parsed.lineRegistration;
        const storedProfile = parsed.profile;
        const source = storedLineRegistration?.source
          ?? (storedLineRegistration?.status === "registered" ? "line_mock" : "none");
        startTransition(() => setState({
          ...initial,
          ...parsed,
          profile: {
            ...initial.profile,
            ...storedProfile,
          },
          lineRegistration: {
            ...initial.lineRegistration,
            ...storedLineRegistration,
            source,
          },
        }));
        LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
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
    if (!hydrated || localTest) return;
    let cancelled = false;
    const loadAccount = async () => {
      try {
        const [meResponse, lineResponse, registrationResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/line/status", { cache: "no-store" }),
          fetch("/api/me/participation", { cache: "no-store" }),
        ]);
        if (meResponse.ok) {
          const me = await meResponse.json() as { user?: { email?: string } };
          if (!cancelled && typeof me.user?.email === "string") {
            setAuthenticatedEmail(me.user.email);
            setSchoolEmail(me.user.email);
          }
        }
        if (lineResponse.ok) {
          const line = await lineResponse.json() as { linked?: boolean; followed?: boolean; officialAccountUrl?: unknown };
          if (!cancelled && typeof line.officialAccountUrl === "string") setLineOfficialAccountUrl(line.officialAccountUrl);
          if (!cancelled) setLineLinkDetail({ linked: Boolean(line.linked), followed: Boolean(line.followed) });
          if (!cancelled) {
            setState((previous) => ({
              ...previous,
              lineRegistration: line.linked && line.followed
                ? { status: "registered", source: "line_live", reminderScheduled: true }
                : { status: "not_started", source: "none", reminderScheduled: false },
            }));
          }
        }
        if (registrationResponse.ok) {
          const { event: registrationPayload, contacts } = await registrationResponse.json() as {
            event: EventState; contacts?: { instagramHandle: string | null; lineContact: string | null };
          };
          if (!cancelled && contacts) setState((previous) => ({ ...previous, profile: {
            ...previous.profile, instagramHandle: contacts.instagramHandle ?? "", lineContact: contacts.lineContact ?? "",
          } }));
          const registration = registrationPayload.registration ?? registrationPayload.previousRegistration;
          if (!cancelled && registration) {
            const participating = registrationPayload.registration?.status === "waiting";
            setState((previous) => ({
              ...previous,
              eventKey: typeof registrationPayload.eventKey === "string" ? registrationPayload.eventKey : previous.eventKey,
              participation: participating,
              phase: participating && (previous.phase === "landing" || previous.phase === "participation") ? "waiting" : previous.phase,
              consent: {
                age: participating && registration.ageConfirmed === true,
                rules: participating && registration.rulesAccepted === true,
              },
              profile: {
                ...previous.profile,
                nickname: typeof registration.nickname === "string" ? registration.nickname : previous.profile.nickname,
                faculty: typeof registration.faculty === "string" ? registration.faculty : previous.profile.faculty,
                year: typeof registration.academicYear === "string" ? registration.academicYear : previous.profile.year,
                gender: typeof registration.gender === "string" ? registration.gender : previous.profile.gender,
                purpose: typeof registration.purpose === "string" ? registration.purpose : previous.profile.purpose,
                preferredGender: typeof registration.preferredGender === "string" ? registration.preferredGender : previous.profile.preferredGender,
              },
            }));
          }
        }
      } catch {
        // The public landing page remains usable when account services are unavailable.
      }
      const lineResult = new URLSearchParams(window.location.search).get("line");
      if (!cancelled && lineResult === "linked-not-following") {
        setState((previous) => ({ ...previous, notice: "LINEログインは完了しました。あとはset-mobの友だち追加だけです。" }));
        setLineModalOpen(true);
      } else if (!cancelled && lineResult === "linked") {
        setState((previous) => ({ ...previous, notice: "LINE連携が完了しました。参加登録を続けられます。" }));
      }
    };
    void loadAccount();
    return () => { cancelled = true; };
    // Account state is intentionally loaded after hydration.
  }, [hydrated, localTest]);

  useEffect(() => {
    if (!hydrated || localTest) return;
    const params = new URLSearchParams(window.location.search);
    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: params.get("ref"),
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
        landingPath: `${window.location.pathname}${window.location.search}`,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [hydrated, localTest]);

  useEffect(() => {
    if (!hydrated) return;
    const scrollReset = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, 50);
    return () => window.clearTimeout(scrollReset);
  }, [hydrated, state.phase]);

  useEffect(() => {
    if (!hydrated || liveParticipationActive) return;
    let cancelled = false;

    const refreshWaitingCount = async () => {
      setWaitingCount((previous) => ({ ...previous, status: previous.count === null ? "loading" : previous.status }));
      try {
        const requestedEventKey = state.eventKey;
        const response = await fetch(`/api/events/${encodeURIComponent(requestedEventKey)}/waiting-count`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Waiting count unavailable");
        const payload = await response.json() as {
          eventKey?: unknown;
          count?: unknown;
          capacity?: unknown;
          remaining?: unknown;
          updatedAt?: string;
          startsAt?: unknown;
          decisionOpensAt?: unknown;
          registrationOpen?: unknown;
          canCancel?: unknown;
          decisionOpen?: unknown;
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
            startsAt: typeof payload.startsAt === "string" ? payload.startsAt : undefined,
            decisionOpensAt: typeof payload.decisionOpensAt === "string" ? payload.decisionOpensAt : undefined,
            registrationOpen: payload.registrationOpen === true,
            canCancel: payload.canCancel === true,
            decisionOpen: payload.decisionOpen === true,
          });
          if (typeof payload.eventKey === "string" && payload.eventKey !== state.eventKey) {
            setRemotePair(null);
            setState((previous) => ({
              ...previous,
              eventKey: payload.eventKey as string,
              participation: false,
              matchingStarted: false,
              phase: previous.phase === "landing" ? "landing" : "participation",
              rankByCandidate: {},
              pair: null,
              setlogStatus: "idle",
              decision: createInitialState().decision,
              result: null,
              notice: previous.eventKey === DEMO_EVENT_KEY
                ? previous.notice
                : "次の土曜の参加受付へ切り替わりました。",
            }));
          }
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
  }, [hydrated, liveParticipationActive, state.eventKey]);

  useEffect(() => {
    const pairId = state.pair?.pairId;
    if (!hydrated || localTest || !pairId || state.phase === "landing" || state.phase === "participation" || state.phase === "waiting") {
      return;
    }
    let cancelled = false;

    const loadPublishedPair = async () => {
      try {
        const response = await fetch(`/api/pairs/${encodeURIComponent(pairId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { pair?: RemotePair };
        const pair = payload.pair;
        if (cancelled || !pair) return;
        setRemotePair(pair);
        setState((previous) => ({
          ...previous,
          pair: previous.pair
            ? { ...previous.pair, pairId: pair.id, candidateId: pair.candidate.id }
            : { pairId: pair.id, candidateId: pair.candidate.id, status: "active" },
          result: pair.result ?? previous.result,
        }));
      } catch {
        // Keep the locally persisted screen available while the pair endpoint is unavailable.
      }
    };

    void loadPublishedPair();
    return () => { cancelled = true; };
  }, [hydrated, localTest, state.pair?.pairId, state.phase]);

  const selectedCandidate = useMemo(
    () => {
      if (remotePair?.candidate && state.pair?.candidateId === remotePair.candidate.id) {
        return {
          id: remotePair.candidate.id,
          displayName: remotePair.candidate.nickname,
          initials: remotePair.candidate.nickname.slice(0, 2).toUpperCase(),
          year: remotePair.candidate.academicYear,
          campus: remotePair.candidate.faculty,
          interests: [],
          weekend: "今日、一日を共有する相手です。",
          color: "sage",
          partnerWants: [],
          faculty: remotePair.candidate.faculty,
          gender: remotePair.candidate.gender,
        } satisfies Candidate;
      }
      return candidates.find((candidate) => candidate.id === state.pair?.candidateId) ?? null;
    },
    [remotePair, state.pair],
  );
  const currentStep = (localTest ? demoPhaseStep : livePhaseStep)[state.phase];
  const phaseLabels = localTest ? demoPhaseLabels : livePhaseLabels;
  const rankedCandidates = Object.entries(state.rankByCandidate).sort(([, a], [, b]) => a - b);

  const updateState = (updates: Partial<StoredState>) => {
    setState((previous) => ({ ...previous, ...updates }));
  };

  const resetDemo = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
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
    setProfileErrors({});
    setPreferenceErrors({});
    setContactErrors({});
    setRemotePair(null);
    setSchoolEmail("");
    setAuthCode("");
    setAuthCodeSent(false);
  };

  const updateProfile = (field: "nickname" | "faculty" | "year" | "gender" | "purpose" | "preferredGender", value: string) => {
    setState((previous) => ({
      ...previous,
      profile: { ...previous.profile, [field]: value },
      notice: null,
    }));
    if (field === "purpose" || field === "preferredGender") {
      setPreferenceErrors((previous) => {
        if (!previous[field]) return previous;
        const next = { ...previous };
        delete next[field];
        return next;
      });
      return;
    }
    const apiField: ProfileField = field === "year" ? "academicYear" : field;
    setProfileErrors((previous) => {
      if (!previous[apiField]) return previous;
      const next = { ...previous };
      delete next[apiField];
      return next;
    });
  };

  const updateContact = (field: ContactField, value: string) => {
    setState((previous) => ({
      ...previous,
      profile: { ...previous.profile, [field]: value },
      notice: null,
    }));
    setContactErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const requestAuthCode = async () => {
    const email = normalizeEmailAddress(schoolEmail);
    if (!email) {
      updateState({ notice: "参加登録に使うメールアドレスを入力してください。" });
      return;
    }
    setAuthSending(true);
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "AUTH_CODE_UNAVAILABLE");
      setSchoolEmail(email);
      setAuthCodeSent(true);
      updateState({ notice: "認証コードをメールに送りました。10分以内に入力してください。" });
    } catch {
      updateState({ notice: "認証コードを送れませんでした。メールアドレスを確認して、もう一度お試しください。" });
    } finally {
      setAuthSending(false);
    }
  };

  const verifyAuthCode = async () => {
    const email = normalizeEmailAddress(schoolEmail);
    if (!email || !/^\d{6}$/.test(authCode.trim())) {
      updateState({ notice: "メールアドレスと6桁の認証コードを入力してください。" });
      return;
    }
    setAuthVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: authCode.trim() }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; user?: { email?: string; lineFollowed?: boolean } } | null;
      if (!response.ok || typeof payload?.user?.email !== "string") throw new Error(payload?.error ?? "AUTH_VERIFICATION_UNAVAILABLE");
      setAuthenticatedEmail(payload.user.email);
      updateState({ notice: "メール認証が完了しました。LINE連携を確認して参加登録を続けてください。" });
    } catch {
      updateState({ notice: "認証コードを確認できませんでした。コードを確認して、もう一度お試しください。" });
    } finally {
      setAuthVerifying(false);
    }
  };

  const handleParticipation = async () => {
    const profilePayload: RegistrationProfile = {
      nickname: state.profile.nickname,
      faculty: state.profile.faculty,
      academicYear: state.profile.year as RegistrationProfile["academicYear"],
      gender: state.profile.gender as RegistrationProfile["gender"],
    };
    const profileValidation = validateRegistrationProfile(profilePayload);
    if (!profileValidation.profile) {
      const nextErrors: Partial<Record<ProfileField, string>> = {};
      profileValidation.missing.forEach((field) => {
        nextErrors[field] = "入力してください。";
      });
      profileValidation.invalid.forEach((field) => {
        nextErrors[field] = field === "nickname" ? "20文字以内で入力してください。" : field === "faculty" ? "40文字以内で入力してください。" : "選択肢から選んでください。";
      });
      setProfileErrors(nextErrors);
      updateState({ notice: "プロフィールの必須項目を入力してください。" });
      return;
    }
    setProfileErrors({});
    const preferenceValidation = validateRegistrationPreferences({
      purpose: state.profile.purpose,
      preferredGender: state.profile.preferredGender,
    });
    if (!preferenceValidation.preferences) {
      const nextErrors: Partial<Record<PreferenceField, string>> = {};
      preferenceValidation.missing.forEach((field) => { nextErrors[field] = "選択してください。"; });
      preferenceValidation.invalid.forEach((field) => { nextErrors[field] = "選択肢から選んでください。"; });
      setPreferenceErrors(nextErrors);
      updateState({ notice: "利用目的と希望する相手を選んでください。" });
      return;
    }
    setPreferenceErrors({});
    const contactValidation = validateContactHandles({
      instagramHandle: state.profile.instagramHandle,
      lineContact: state.profile.lineContact,
    });
    if (contactValidation.invalid.length > 0) {
      const nextErrors: Partial<Record<ContactField, string>> = {};
      contactValidation.invalid.forEach((field) => {
        nextErrors[field] = field === "instagramHandle" ? "Instagramのユーザーネームを確認してください。" : "120文字以内で入力してください。";
      });
      setContactErrors(nextErrors);
      updateState({ notice: "連絡先の入力内容を確認してください。" });
      return;
    }
    setContactErrors({});
    if (!state.consent.age || !state.consent.rules) {
      updateState({ notice: "年齢確認と安全ルールへの同意が必要です。" });
      return;
    }
    if (!localTest && !authenticatedEmail) {
      updateState({ notice: "参加登録に使うメールアドレスを認証してください。" });
      return;
    }
    const normalizedAuthEmail = normalizeEmailAddress(schoolEmail);
    if (!localTest && !normalizedAuthEmail) {
      updateState({ notice: "参加登録に使うメールアドレスを入力してください。" });
      return;
    }
    if (!localTest && state.lineRegistration.status !== "registered") {
      updateState({ notice: "参加登録には、LINE連携と友だち追加が必要です。" });
      return;
    }
    const localTestRegistration = localTest;
    setParticipationSubmitting(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(state.eventKey)}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: profileValidation.profile,
          preferences: preferenceValidation.preferences,
          contacts: contactValidation.contacts,
          ageConfirmed: state.consent.age,
          rulesAccepted: state.consent.rules,
          lineRegistered: state.lineRegistration.source === "line_mock" || state.lineRegistration.source === "line_live",
          lineTestBypass: localTestRegistration,
          schoolEmailTestBypass: localTestRegistration,
          ...(normalizedAuthEmail ? { schoolEmail: normalizedAuthEmail } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: unknown;
        count?: unknown;
        capacity?: unknown;
        remaining?: unknown;
        updatedAt?: string;
        startsAt?: unknown;
        decisionOpensAt?: unknown;
        registrationOpen?: unknown;
        canCancel?: unknown;
        decisionOpen?: unknown;
        fields?: unknown;
      } | null;
      if ((payload?.error === "PROFILE_REQUIRED" || payload?.error === "PROFILE_INVALID") && Array.isArray(payload.fields)) {
        const serverErrors: Partial<Record<ProfileField, string>> = {};
        payload.fields.forEach((field) => {
          if (typeof field === "string" && field in profileFieldLabels) {
            serverErrors[field as ProfileField] = "入力内容を確認してください。";
          }
        });
        setProfileErrors(serverErrors);
        updateState({ notice: "プロフィールの入力内容を確認してください。" });
        return;
      }
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
      if (response.status === 409 && payload?.error === "EVENT_REGISTRATION_CLOSED") {
        updateState({ notice: "今回の参加登録は締め切りました。次回開催をお待ちください。" });
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
        startsAt: typeof payload.startsAt === "string" ? payload.startsAt : undefined,
        decisionOpensAt: typeof payload.decisionOpensAt === "string" ? payload.decisionOpensAt : undefined,
        registrationOpen: payload.registrationOpen === true,
        canCancel: payload.canCancel === true,
        decisionOpen: payload.decisionOpen === true,
      });
      updateState({
        participation: true,
        matchingStarted: false,
        phase: "waiting",
        notice: null,
      });
    } catch {
      updateState({ notice: "参加登録ができませんでした。通信状況を確認して、もう一度お試しください。" });
    } finally {
      setParticipationSubmitting(false);
    }
  };

  const waitingCountText = waitingCount.status === "error"
    ? "参加人数を確認できません"
    : waitingCount.count !== null
      ? `現在${waitingCount.count}人`
      : "人数を確認中…";

  const remainingSlotsText = waitingCount.status === "error"
    ? "残りの参加枠を確認できません"
    : waitingCount.remaining !== null
      ? `残り${waitingCount.remaining}枠`
      : "残りの参加枠を確認中…";
  const eventIsFull = waitingCount.status === "ready" && waitingCount.remaining === 0;
  const decisionIsOpen = !remotePair || remotePair.decisionOpen || waitingCount.decisionOpen === true;
  const eventDateText = waitingCount.startsAt
    ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date(waitingCount.startsAt))
    : "次の土曜";

  const cancelParticipation = async () => {
    if (localTest) {
      updateState({ participation: false, matchingStarted: false, phase: "participation", notice: "今回の参加をキャンセルしました。" });
      return;
    }
    setParticipationSubmitting(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(state.eventKey)}/registrations`, { method: "DELETE" });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (response.status === 409 && payload?.error === "REGISTRATION_CANCELLATION_CLOSED") {
        updateState({ notice: "開始時刻を過ぎたため、アプリからはキャンセルできません。" });
        return;
      }
      if (!response.ok) throw new Error("Cancellation unavailable");
      setRemotePair(null);
      updateState({ participation: false, matchingStarted: false, phase: "participation", pair: null, notice: "今回の参加をキャンセルしました。開始前なら、もう一度登録できます。" });
    } catch {
      updateState({ notice: "参加をキャンセルできませんでした。通信を確認して、もう一度お試しください。" });
    } finally {
      setParticipationSubmitting(false);
    }
  };

  const completeLineRegistration = async () => {
    if (!localTest) {
      // LINE OAuth needs a full-document navigation so the API redirect can leave this origin.
      window.location.assign(new URL("/api/line/login", window.location.origin));
      return;
    }
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

  const recheckLineStatus = async () => {
    setLineRechecking(true);
    try {
      const response = await fetch("/api/line/status", { cache: "no-store" });
      if (!response.ok) throw new Error("LINE status unavailable");
      const line = await response.json() as { linked?: boolean; followed?: boolean; officialAccountUrl?: unknown };
      if (typeof line.officialAccountUrl === "string") setLineOfficialAccountUrl(line.officialAccountUrl);
      setLineLinkDetail({ linked: Boolean(line.linked), followed: Boolean(line.followed) });
      if (line.linked && line.followed) {
        setState((previous) => ({
          ...previous,
          lineRegistration: { status: "registered", source: "line_live", reminderScheduled: true },
          notice: "LINE連携が完了しました。参加登録を続けられます。",
        }));
        setLineModalOpen(false);
      } else {
        updateState({ notice: "まだ友だち追加が確認できません。友だち追加をしてから、もう一度確認してください。" });
      }
    } catch {
      updateState({ notice: "状態を確認できませんでした。通信を確認して、もう一度お試しください。" });
    } finally {
      setLineRechecking(false);
    }
  };

  const startLineRegistration = () => {
    if (!localTest && !authenticatedEmail) {
      updateState({ notice: "LINE連携の前に、メールアドレスを認証してください。" });
      return;
    }
    updateState({ notice: null });
    setLineModalOpen(true);
  };

  const startMatching = async () => {
    if (!state.participation) {
      updateState({ phase: "participation", notice: "次の土曜への参加登録を完了してください。" });
      return;
    }
    if (!localTest) {
      setPairLoading(true);
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(state.eventKey)}/pair`, { cache: "no-store" });
        if (response.status === 404) {
          updateState({ notice: "開始時刻になると、今日の相手を確認できます。" });
          return;
        }
        if (!response.ok) throw new Error("Pair unavailable");
        const payload = await response.json() as { pair?: RemotePair };
        if (!payload.pair) throw new Error("Pair missing");
        setRemotePair(payload.pair);
        updateState({
          matchingStarted: true,
          phase: "dayPair",
          pair: { pairId: payload.pair.id, candidateId: payload.pair.candidate.id, status: "active" },
          setlogStatus: "idle",
          decision: createInitialState().decision,
          result: payload.pair.result,
          notice: null,
        });
      } catch {
        updateState({ notice: "今日の相手を確認できませんでした。時間をおいて、もう一度お試しください。" });
      } finally {
        setPairLoading(false);
      }
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
      if (remotePair) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        updateState({ setlogStatus: "connected", notice: null });
        return;
      }
      const connection = await mockSetlogAdapter.createConnection(selectedCandidate.id);
      updateState({ setlogStatus: connection.status, notice: null });
    } catch {
      updateState({ setlogStatus: "error", notice: "Setlogへの接続に失敗しました。もう一度試してください。" });
    }
  };

  const openDecision = () => {
    if (!decisionIsOpen) {
      updateState({ notice: "今後どうしたいかは、土曜22時から回答できます。" });
      return;
    }
    updateState({ phase: "decision", notice: null });
  };

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

  const confirmDecision = async () => {
    if (!selectedCandidate) return;
    const { instagram, line, continue: continueChoice, none } = state.decision;
    if (!instagram && !line && !continueChoice && !none) {
      updateState({ notice: "希望するものか、「今回はここで終える」を選んでください。" });
      return;
    }
    if (remotePair) {
      try {
        const response = await fetch(`/api/pairs/${encodeURIComponent(remotePair.id)}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instagram,
            line,
            continue: continueChoice,
            none,
          }),
        });
        const payload = await response.json().catch(() => null) as { error?: string; result?: ResultState; pair?: RemotePair } | null;
        if (!response.ok || !payload?.pair) {
          updateState({ notice: payload?.error === "INSTAGRAM_CONTACT_REQUIRED" ? "Instagramの連絡先を先に登録してください。" : payload?.error === "LINE_CONTACT_REQUIRED" ? "LINEの連絡先を先に登録してください。" : payload?.error === "DECISION_NOT_OPEN" ? "今後どうしたいかは、土曜22時から回答できます。" : "回答を送信できませんでした。もう一度お試しください。" });
          return;
        }
        setRemotePair(payload.pair);
        updateState({
          decision: { ...state.decision, answered: true },
          result: payload.result ?? null,
          phase: payload.result?.kind === "pending" ? "decision" : "result",
          pair: payload.result?.kind === "pending" ? state.pair : state.pair ? { ...state.pair, status: "ended", endedReason: "decision" } : null,
          notice: payload.result?.kind === "pending" ? "回答を受け付けました。相手の回答を待っています。" : null,
        });
      } catch {
        updateState({ notice: "回答を保存できませんでした。もう一度お試しください。" });
      }
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

  const endForSafety = async (reason: "blocked" | "reported") => {
    if (remotePair) {
      try {
        await fetch(`/api/pairs/${encodeURIComponent(remotePair.id)}/${reason === "blocked" ? "block" : "report"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: reason === "reported" ? JSON.stringify({ reason: reportReason, detail: reportDetail }) : undefined,
        });
      } catch {
        // The local state still closes the view if the safety endpoint is unavailable.
      }
    } else if (state.pair) {
      void mockSetlogAdapter.endConnection(state.pair.candidateId);
    }
    updateState({
      phase: "ended",
      pair: state.pair ? { ...state.pair, status: reason === "blocked" ? "blocked" : "ended", endedReason: reason } : null,
      setlogStatus: "idle",
      notice: reason === "blocked" ? "相手を非表示にしました。これ以上の通知は届きません。" : "通報を受け付けました。確認が終わるまで相手を非表示にします。",
    });
    setSafetyOpen(false);
    setSafetyError("");
  };

  const submitReport = async () => {
    if (!reportReason) {
      setSafetyError("通報理由を選択してください。");
      return;
    }
    await endForSafety("reported");
  };

  if (!hydrated) {
    return (
      <main className="loading-screen">
        <Image className="brand-mark brand-mark--large brand-mark--image" src="/set-mob-avatar.png" alt="" width={104} height={104} priority />
        <p>読み込み中…</p>
      </main>
    );
  }

  if (!localTest && authenticatedEmail && state.participation) return <LiveParticipation onRegister={liveRegister} onExpired={liveExpired} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="set-mob">
          <Image className="brand-mark brand-mark--image" src="/set-mob-avatar.png" alt="" width={72} height={72} priority />
          <span>
            <strong>set-mob</strong>
            <small>青学生の土曜日</small>
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
                  ブロック・通報
                </button>
              )}
              <Link role="menuitem" href="/safety">安全ガイド</Link>
              <Link role="menuitem" href="/contact">問い合わせ・削除</Link>
              <button type="button" role="menuitem" onClick={resetDemo}>
                {localTest ? "デモを最初からやり直す" : "最初の画面へ"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {localTest && <p className="notice" role="note">デモ画面です。プロフィールや結果は架空のもので、実際の参加登録・連絡先交換は行われません。</p>}
        {state.phase !== "landing" && (
          <div className="progress-panel" aria-label="参加の進行状況">
            <div className="progress-topline">
              <span>{eventDateText} / 12:00</span>
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
              <p className="eyebrow">青学生限定・土曜の出会い</p>
              <h1>知らない青学生と、<em>土曜日をシェア。</em></h1>
              <p className="hero-lede">
                Setlogで、お互いのいつもの土曜日を共有。夜になったら、連絡先を交換するか、明日も続けるかをそれぞれ選べます。
              </p>
              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={() => updateState({ phase: "participation", notice: null })}
                  disabled={eventIsFull && !state.participation}
                >
                  {eventIsFull && !state.participation ? "初回募集は満員です" : "次の土曜に参加する"} <span>↗</span>
                </button>
                <span className="micro-copy">初回100人限定 / 18歳以上 / 青学生限定</span>
              </div>
            </div>

            <div className="event-card">
              <div className="event-card__top">
                <span className="status-pill"><span className="status-dot" />{eventIsFull ? "受付終了" : "受付中"}</span>
                <span className="event-number">初回開催</span>
              </div>
              <div className="date-lockup">
                <span>{eventDateText}</span>
                <strong>土曜</strong>
                <span>12:00 スタート</span>
              </div>
              <div className="event-card__count" aria-live="polite">
                <span className="label">初回募集 / 100人限定</span>
                <strong>{remainingSlotsText}</strong>
                <small>{waitingCountText} / LINE登録済みの参加者</small>
              </div>
              <div className="event-card__bottom">
                <div>
                  <span className="label">土曜の過ごし方</span>
                  <strong>一日の共有から始まる出会い</strong>
                </div>
                <span className="arrow-badge">↗</span>
              </div>
            </div>

            <div className="principles-card">
              <span className="label">このアプリの流れ</span>
              <div className="principle-list">
                <div><span>01</span><strong>出会う</strong><p>土曜12時に、今日の相手を確認。</p></div>
                <div><span>02</span><strong>共有する</strong><p>Setlogで、お互いの一日を見る。</p></div>
                <div><span>03</span><strong>選ぶ</strong><p>夜に、この先どうするかを選ぶ。</p></div>
              </div>
            </div>
          </section>
        )}

        {state.phase === "participation" && (
          <section className="page-section narrow-section">
            <p className="eyebrow">01 / 参加登録</p>
            <h2>次の土曜に、<br /><em>参加しませんか。</em></h2>
            <p className="section-lede">プロフィールと希望を登録してください。土曜12時に、条件の合う相手を確認できます。</p>
            <div className="profile-form" aria-labelledby="profile-form-title">
              <div className="profile-form__header">
                <div><span className="label">あなたについて</span><strong id="profile-form-title">プロフィールを入力してください</strong></div>
                <span className="required-note">基本情報は必須</span>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-nickname"><span>ニックネーム</span><span className="required-mark">必須</span></label>
                <input
                  id="profile-nickname"
                  type="text"
                  autoComplete="nickname"
                  maxLength={20}
                  value={state.profile.nickname}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(profileErrors.nickname)}
                  aria-describedby={profileErrors.nickname ? "profile-nickname-error" : undefined}
                  onChange={(event) => updateProfile("nickname", event.target.value)}
                  placeholder="例：ゆうき"
                />
                {profileErrors.nickname && <small id="profile-nickname-error" className="field-error" role="alert">{profileErrors.nickname}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-faculty"><span>学部</span><span className="required-mark">必須</span></label>
                <input
                  id="profile-faculty"
                  type="text"
                  maxLength={40}
                  value={state.profile.faculty}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(profileErrors.faculty)}
                  aria-describedby={profileErrors.faculty ? "profile-faculty-error" : undefined}
                  onChange={(event) => updateProfile("faculty", event.target.value)}
                  placeholder="例：経済学部"
                />
                {profileErrors.faculty && <small id="profile-faculty-error" className="field-error" role="alert">{profileErrors.faculty}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-year"><span>学年</span><span className="required-mark">必須</span></label>
                <select
                  id="profile-year"
                  value={state.profile.year}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(profileErrors.academicYear)}
                  aria-describedby={profileErrors.academicYear ? "profile-year-error" : undefined}
                  onChange={(event) => updateProfile("year", event.target.value)}
                >
                  <option value="">選択してください</option>
                  {PROFILE_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                {profileErrors.academicYear && <small id="profile-year-error" className="field-error" role="alert">{profileErrors.academicYear}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-gender"><span>性別</span><span className="required-mark">必須</span></label>
                <select
                  id="profile-gender"
                  value={state.profile.gender}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(profileErrors.gender)}
                  aria-describedby={profileErrors.gender ? "profile-gender-error" : undefined}
                  onChange={(event) => updateProfile("gender", event.target.value)}
                >
                  <option value="">選択してください</option>
                  {PROFILE_GENDERS.map((gender) => <option key={gender} value={gender}>{profileGenderLabels[gender]}</option>)}
                </select>
                {profileErrors.gender && <small id="profile-gender-error" className="field-error" role="alert">{profileErrors.gender}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-purpose"><span>利用目的</span><span className="required-mark">必須</span></label>
                <select id="profile-purpose" value={state.profile.purpose} required aria-required="true" aria-invalid={Boolean(preferenceErrors.purpose)} aria-describedby={preferenceErrors.purpose ? "profile-purpose-error" : "profile-purpose-help"} onChange={(event) => updateProfile("purpose", event.target.value)}>
                  <option value="">選択してください</option>
                  {MATCH_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{matchPurposeLabels[purpose]}</option>)}
                </select>
                <small id="profile-purpose-help">同じ目的か、「どちらでも」を選んだ相手とつながります。</small>
                {preferenceErrors.purpose && <small id="profile-purpose-error" className="field-error" role="alert">{preferenceErrors.purpose}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-preferred-gender"><span>希望する相手の性別</span><span className="required-mark">必須</span></label>
                <select id="profile-preferred-gender" value={state.profile.preferredGender} required aria-required="true" aria-invalid={Boolean(preferenceErrors.preferredGender)} aria-describedby={preferenceErrors.preferredGender ? "profile-preferred-gender-error" : "profile-preferred-gender-help"} onChange={(event) => updateProfile("preferredGender", event.target.value)}>
                  {GENDER_PREFERENCES.map((gender) => <option key={gender} value={gender}>{genderPreferenceLabels[gender]}</option>)}
                </select>
                <small id="profile-preferred-gender-help">お互いの希望が合う相手をご案内します。</small>
                {preferenceErrors.preferredGender && <small id="profile-preferred-gender-error" className="field-error" role="alert">{preferenceErrors.preferredGender}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-instagram"><span>Instagramユーザーネーム</span><span className="optional-note">任意</span></label>
                <input
                  id="profile-instagram"
                  type="text"
                  autoComplete="off"
                  maxLength={40}
                  value={state.profile.instagramHandle}
                  aria-invalid={Boolean(contactErrors.instagramHandle)}
                  aria-describedby={contactErrors.instagramHandle ? "profile-instagram-error" : "profile-instagram-help"}
                  onChange={(event) => updateContact("instagramHandle", event.target.value)}
                  placeholder="例：yuki_123"
                />
                <small id="profile-instagram-help">お互いがInstagramの交換を希望したときだけ、相手に表示します。</small>
                {contactErrors.instagramHandle && <small id="profile-instagram-error" className="field-error" role="alert">{contactErrors.instagramHandle}</small>}
              </div>
              <div className="profile-field">
                <label htmlFor="profile-line-contact"><span>LINEのID・友だち追加リンク</span><span className="optional-note">任意</span></label>
                <input
                  id="profile-line-contact"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  value={state.profile.lineContact}
                  aria-invalid={Boolean(contactErrors.lineContact)}
                  aria-describedby={contactErrors.lineContact ? "profile-line-contact-error" : "profile-line-contact-help"}
                  onChange={(event) => updateContact("lineContact", event.target.value)}
                  placeholder="例：https://line.me/ti/p/…"
                />
                <small id="profile-line-contact-help">お互いがLINEの交換を希望したときだけ、相手に表示します。</small>
                {contactErrors.lineContact && <small id="profile-line-contact-error" className="field-error" role="alert">{contactErrors.lineContact}</small>}
              </div>
            </div>
            {localTest ? (
              <div className="local-test-note" role="status">
                <span className="local-test-note__mark">デモ</span>
                <div><strong>参加の流れを試せます</strong><p>メール認証とLINE連携を省略します。実際の参加登録は行いません。</p></div>
              </div>
            ) : (
              <div className="school-email-field">
                <label htmlFor="school-email">メールアドレス</label>
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
                  placeholder="name@example.com"
                  aria-describedby="school-email-help"
                />
                <small id="school-email-help">参加登録に使えるメールアドレスへ、6桁の認証コードを送ります。</small>
                {!authenticatedEmail && <button className="secondary-button" type="button" onClick={requestAuthCode} disabled={authSending}>{authSending ? "送信中…" : "認証コードを送る"}</button>}
                {authCodeSent && !authenticatedEmail && <div className="auth-code-row"><label htmlFor="auth-code">認証コード</label><div><input id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authCode} onChange={(event) => setAuthCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /><button className="primary-button" type="button" onClick={verifyAuthCode} disabled={authVerifying}>{authVerifying ? "確認中…" : "認証する"}</button></div></div>}
                {authenticatedEmail && <small className="auth-success" role="status">メール認証済み：{authenticatedEmail}</small>}
              </div>
            )}
            <div className="check-list">
              <label className={`check-row ${state.consent.age ? "is-checked" : ""}`}>
                <input type="checkbox" checked={state.consent.age} onChange={(event) => updateState({ consent: { ...state.consent, age: event.target.checked }, notice: null })} />
                <span className="fake-check">✓</span>
                <span><strong>私は18歳以上です</strong><small>18歳以上の青学生が参加できます。</small></span>
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
                <strong>{state.lineRegistration.status === "registered" ? "LINE連携・友だち追加済み" : lineLinkDetail?.linked && !lineLinkDetail.followed ? "LINEログイン済み。あとは友だち追加だけです" : "LINEを連携して、金曜の案内を受け取る"}</strong>
                <p>{state.lineRegistration.status === "registered" ? "金曜21時に、翌日の参加確認をお送りします。" : lineLinkDetail?.linked && !lineLinkDetail.followed ? "set-mobを友だち追加すると、参加登録ができるようになります。" : "参加登録には、LINEへのログインと友だち追加が必要です。"}</p>
              </div>
              {state.lineRegistration.status === "registered" && <span className="line-setup-card__check">✓</span>}
            </div>}
            <button className="primary-button full-width" onClick={localTest || state.lineRegistration.status === "registered" ? handleParticipation : startLineRegistration} disabled={participationSubmitting}>
              {participationSubmitting ? "参加登録中…" : localTest ? "デモに参加する" : state.lineRegistration.status === "registered" ? "参加登録を完了する" : "LINE連携を始める"} <span>→</span>
            </button>
          </section>
        )}

        {state.phase === "waiting" && (
          <section className="page-section narrow-section waiting-section">
            <p className="eyebrow">02 / 開始を待つ</p>
            <h2>参加登録が、<br /><em>完了しました。</em></h2>
            <p className="section-lede">土曜12時に、今日の相手を確認できます。条件に合う相手が見つからない場合もあります。</p>
            <div className="waiting-card">
              <div className="waiting-card__top"><span className="status-pill status-pill--light"><span className="status-dot" />参加登録済み</span><span className="event-number">{eventDateText}</span></div>
              <div className="waiting-card__date"><span>{eventDateText}</span><strong>12:00</strong><small>スタート</small></div>
              <div className="waiting-card__copy"><strong>土曜になったら、この画面へ</strong><p>開始時刻になったら、下のボタンから確認してください。</p></div>
              <div className="waiting-card__line"><span className="line-badge">LINE</span><div><strong>{localTest ? "金曜21時にLINEでご案内" : "金曜21時のご案内を設定済み"}</strong><p>{localTest ? "実際の参加では、翌日の参加確認をLINEでお送りします。" : "翌日の参加確認をLINEでお送りします。"}</p></div></div>
              <div className="waiting-card__count" aria-live="polite"><span className="label">初回募集 / 100人限定</span><strong>{remainingSlotsText}</strong><p>{waitingCountText}。{eventDateText}に参加予定の人数です。</p></div>
            </div>
            <button className="primary-button full-width" onClick={() => void startMatching()} disabled={pairLoading}>{pairLoading ? "今日の相手を確認中…" : localTest ? "候補を見る（デモ）" : "今日の相手を確認する"} <span>→</span></button>
            {(localTest || waitingCount.canCancel) && <button className="secondary-button full-width" type="button" onClick={() => void cancelParticipation()} disabled={participationSubmitting}>{participationSubmitting ? "キャンセル中…" : "今回の参加をキャンセル"}</button>}
            <p className="waiting-note">土曜12時に、条件が合った相手をここで確認できます。</p>
          </section>
        )}

        {state.phase === "recommendation" && (
          <section className="page-section">
            <div className="section-heading-row"><div><p className="eyebrow">03 / 候補を見る（デモ）</p><h2>今日の候補は、<em>この3人。</em></h2></div><span className="count-note">架空のプロフィール</span></div>
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
            <div className="section-heading-row"><div><p className="eyebrow">04 / 希望順位を選ぶ（デモ）</p><h2>気になる順に、<em>選んでください。</em></h2></div><span className="count-note">最大3人 / 1人からOK</span></div>
            <p className="section-lede">選んだ順位は、マッチングのためだけに使います。「第3希望だった」と相手に伝わることはありません。</p>
            <div className="ranking-layout">
              <div className="ranking-list">
                {candidates.map((candidate) => {
                  const rank = state.rankByCandidate[candidate.id];
                  return <article className={`ranking-card ${rank ? "is-ranked" : ""}`} key={candidate.id}><div className={`mini-avatar avatar--${candidate.color}`}>{candidate.initials}</div><div className="ranking-card__body"><div><strong>{candidate.displayName}</strong><span>{candidate.year} / {candidate.campus}</span></div><div className="rank-buttons" aria-label={`${candidate.displayName}の希望順位`}><button className={rank === 1 ? "selected" : ""} onClick={() => toggleRank(candidate.id, 1)} aria-label={`${candidate.displayName}を第1希望にする`}>1</button><button className={rank === 2 ? "selected" : ""} onClick={() => toggleRank(candidate.id, 2)} aria-label={`${candidate.displayName}を第2希望にする`}>2</button><button className={rank === 3 ? "selected" : ""} onClick={() => toggleRank(candidate.id, 3)} aria-label={`${candidate.displayName}を第3希望にする`}>3</button></div></div></article>;
                })}
              </div>
              <aside className="rank-summary"><span className="label">あなたの希望順位</span><div className="rank-summary__list">{[1, 2, 3].map((rank) => { const entry = rankedCandidates.find(([, value]) => value === rank); const candidate = candidates.find((item) => item.id === entry?.[0]); return <div className="summary-row" key={rank}><span className="rank-circle">{rank}</span><span>{candidate?.displayName ?? "まだ選択していません"}</span></div>; })}</div><p>デモでは、第1希望の相手との画面に進みます。</p><button className="primary-button full-width" onClick={confirmRanking}>この順位で確定する <span>→</span></button></aside>
            </div>
          </section>
        )}

        {state.phase === "dayPair" && selectedCandidate && (
          <section className="page-section pair-section">
            <p className="eyebrow">05 / 今日の相手</p>
            <div className="pair-intro"><div><h2>今日の相手は、<br /><em>{selectedCandidate.displayName}さん。</em></h2><p>今日は、Setlogでお互いの一日を共有しましょう。</p></div><div className={`pair-avatar avatar--${selectedCandidate.color}`}><span>{selectedCandidate.initials}</span><i>●</i></div></div>
            <div className="pair-timeline"><div className="timeline-item is-done"><span>12:00</span><div><strong>今日の相手を確認</strong><p>お互いの希望順位は表示されません。</p></div></div><div className="timeline-item is-current"><span>12:00 — 22:00</span><div><strong>Setlogで一日を共有</strong><p>連絡先を聞く前に、お互いの土曜日を見てみましょう。</p></div></div><div className="timeline-item"><span>22:00 — 23:00</span><div><strong>この先どうするかを回答</strong><p>回答は相手に表示されません。</p></div></div></div>
            <div className="rule-callout"><span>✳</span><p><strong>今日の共有は23時までです。</strong><br />連絡先を交換するか、明日も続けるかは、夜にそれぞれ選べます。</p></div>
            <div className="pair-actions"><button className="primary-button full-width" onClick={() => updateState({ phase: "setlog", notice: null })}>Setlogの参加方法を見る <span>↗</span></button></div>
          </section>
        )}

        {state.phase === "setlog" && selectedCandidate && (
          <section className="page-section narrow-section">
            <p className="eyebrow">05 / Setlogで共有する</p>
            <h2>まずは、<em>一日を共有しよう。</em></h2>
            <p className="section-lede">外部アプリのSetlogで、お互いの土曜日を共有します。連絡先を交換するかは、夜に選べます。</p>
            <div className="setlog-card"><div className="setlog-card__head"><div className="setlog-logo">Setlog<span>↗</span></div><span className="status-pill status-pill--light">今日の共有先</span></div><div className="setlog-room"><div className={`pair-avatar avatar--${selectedCandidate.color}`}><span>{selectedCandidate.initials}</span></div><div><span className="label">一日を共有する相手</span><strong>あなた × {selectedCandidate.displayName}さん</strong><p>12:00 — 22:00 / 土曜日を共有</p></div></div>{state.setlogStatus === "connected" ? <div className="connected-message"><span>✓</span><div><strong>{remotePair ? "Setlogの参加情報を確認できます" : "共有中の画面です（デモ）"}</strong><p>{remotePair ? "下の招待コードかリンクから参加してください。" : "実際の参加では、Setlogで一日を共有したあと、22時にここへ戻ってきてください。"}</p></div></div> : state.setlogStatus === "error" ? <div className="error-message"><strong>参加情報を確認できませんでした</strong><p>通信状況を確認して、もう一度お試しください。</p></div> : <div className="setlog-card__action"><p>{remotePair ? "Setlogの招待コードとリンクを表示します。" : "デモでは、Setlogを使わず次の画面を確認できます。"}</p><button className="primary-button" onClick={connectSetlog} disabled={state.setlogStatus === "connecting"}>{state.setlogStatus === "connecting" ? "確認中…" : remotePair ? "参加情報を確認する" : "共有中の画面を見る（デモ）"}<span>↗</span></button></div>}{remotePair && state.setlogStatus === "connected" && <div className="setlog-access"><span className="label">Setlogの招待コード</span><strong>{remotePair.setlogCode}</strong>{remotePair.setlogUrl && <a href={remotePair.setlogUrl} target="_blank" rel="noreferrer">Setlogを開く ↗</a>}</div>}</div>
            {state.setlogStatus === "connected" && <><div className="setlog-next"><div><span className="label">今日の振り返り</span><strong>回答できるのは22:00〜23:00です</strong><p>連絡先を交換するか、明日も続けるかを選べます。回答は相手に表示されません。</p></div></div><button className="primary-button full-width" onClick={openDecision} disabled={!decisionIsOpen}>{decisionIsOpen ? "回答画面へ進む" : "22時から回答できます"} <span>→</span></button></>}
            {state.setlogStatus === "error" && <button className="primary-button full-width" onClick={connectSetlog}>もう一度接続する <span>↻</span></button>}
          </section>
        )}

        {state.phase === "decision" && selectedCandidate && (
          <section className="page-section narrow-section decision-section">
            <div className="decision-top"><div><p className="eyebrow">06 / 今日の振り返り</p><h2>今日の相手と、<br /><em>この先どうしたい？</em></h2></div><div className="decision-time"><strong>22:00</strong><span>回答受付中</span></div></div>
            <p className="section-lede">回答は相手に表示されません。お互いの回答がそろうと、二人とも交換を希望した連絡先だけを表示します。「明日（日曜）も続けたい」を選んだ場合は、今回は連絡先を交換しません。</p>
            <div className="decision-options">{(["instagram", "line", "continue", "none"] as DecisionOption[]).map((option) => <button key={option} className={`decision-option ${state.decision[option] ? "is-selected" : ""} ${option === "none" ? "is-muted" : ""}`} onClick={() => toggleDecision(option)} aria-pressed={state.decision[option]}><span className="decision-icon">{option === "instagram" ? "◎" : option === "line" ? "▣" : option === "continue" ? "↻" : "—"}</span><span><strong>{optionLabels[option]}</strong><small>{option === "instagram" || option === "line" ? "お互いが希望したときだけ表示" : option === "continue" ? "日曜12時から、同じ相手と一日を共有" : "連絡先を交換せずに終了"}</small></span><span className="select-mark">{state.decision[option] ? "✓" : "＋"}</span></button>)}</div>
            <div className="privacy-note"><span>非公開</span><p>希望が合わなかった項目や、お互いの希望順位は表示されません。</p></div>
            <button className="primary-button full-width" onClick={confirmDecision}>この内容で回答する <span>→</span></button>
          </section>
        )}

        {state.phase === "result" && selectedCandidate && state.result && (
          <section className="page-section result-section">
            <div className="result-stamp">{state.result.kind === "pending" ? "回答を送信しました" : "今日の結果"}</div>
            {state.result.kind === "pending" && <><p className="eyebrow">07 / 回答待ち</p><h2>相手の回答を、<br /><em>待っています。</em></h2><p className="section-lede">お互いの回答がそろうと、結果を確認できます。回答は相手に表示されません。</p><div className="result-note"><span>…</span><div><strong>この画面を閉じても大丈夫です</strong><p>回答がそろったら、次に開いたときに結果を確認できます。</p></div></div></>}
            {state.result.kind === "disclosed" && <><p className="eyebrow">07 / 連絡先の交換</p><h2>お互いに、<br /><em>交換を希望しました。</em></h2><p className="section-lede">{selectedCandidate.displayName}さんと、二人とも交換を希望した連絡先です。ここからは、お互いのペースでやりとりしてください。</p><div className="disclosed-list">{state.result.items.map((item) => <div className="disclosed-item" key={item}><span className="disclosed-icon">{item === "instagram" ? "◎" : item === "line" ? "▣" : "↻"}</span><strong>{item === "instagram" ? "Instagram" : item === "line" ? "LINE" : "日曜も続ける"}</strong><span className="disclosed-check">お互いに希望 ✓</span>{disclosedContact(state.result!, item) && <code>{disclosedContact(state.result!, item)}</code>}</div>)}</div></>}
            {state.result.kind === "continued" && <><p className="eyebrow">07 / 日曜も続ける</p><h2>明日も、<br /><em>同じ相手と。</em></h2><p className="section-lede">お互いに「明日（日曜）も続けたい」を選びました。日曜12時から、Setlogの同じログで一日を共有します。</p><div className="result-note result-note--sage"><span>↻</span><div><strong>今回は連絡先を交換しません</strong><p>日曜の夜に、あらためて交換するか選べます。</p></div></div></>}
            {state.result.kind === "ended" && <><p className="eyebrow">07 / 今回は終了</p><h2>今日は、<br /><em>ここまで。</em></h2><p className="section-lede">ご参加ありがとうございました。お互いの回答内容や、終了した理由は表示されません。</p><div className="result-note"><span>○</span><div><strong>連絡先は交換されていません</strong><p>set-mobで、同じ相手を再びご案内することはありません。</p></div></div></>}
            <div className="result-footer"><button className="primary-button full-width" onClick={resetDemo}>次の土曜を見る <span>→</span></button><span>また参加したくなったら、いつでも戻ってきてください。</span></div>
          </section>
        )}

        {state.phase === "ended" && (
          <section className="page-section narrow-section result-section"><div className="result-stamp">今回は終了しました</div><p className="eyebrow">ブロック・通報</p><h2>相手を、<br /><em>非表示にしました。</em></h2><p className="section-lede">{state.notice ?? "今回の共有は終了しました。相手の情報はこれ以上表示されません。"}</p><div className="result-note"><span>✓</span><div><strong>同じ相手は再び表示されません</strong><p>Setlogでの退出・ブロックは、Setlogで操作してください。</p></div></div><button className="primary-button full-width" onClick={resetDemo}>最初の画面へ <span>→</span></button></section>
        )}
      </main>

      <footer className="app-footer"><span>set-mob / 青学生の土曜日</span><span>連絡先は、お互いが交換を希望した場合だけ表示します。</span><nav aria-label="規約とサポート"><Link href="/terms">利用規約</Link><Link href="/privacy">プライバシー</Link><Link href="/safety">安全ガイド</Link><Link href="/contact">お問い合わせ・退会</Link></nav><span>set-mobは独立運営のサービスです。青山学院大学およびSetlogの公式・公認サービスではありません。</span></footer>

      {safetyOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSafetyOpen(false)}>
          <section className="safety-modal" role="dialog" aria-modal="true" aria-labelledby="safety-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top"><div><span className="eyebrow">ブロック・通報</span><h2 id="safety-title">困ったときは、<br /><em>すぐに離れて大丈夫。</em></h2></div><button className="close-button" onClick={() => setSafetyOpen(false)} aria-label="ブロック・通報を閉じる">×</button></div>
            <p>返信をしなくても、理由を説明しなくても大丈夫です。ブロックすると相手を非表示にし、通報すると運営に共有します。</p>
            <div className="safety-actions"><button className="danger-button" onClick={() => endForSafety("blocked")}>相手をブロックする</button><div className="report-box"><label htmlFor="report-reason">通報理由</label><select id="report-reason" value={reportReason} onChange={(event) => { setReportReason(event.target.value); setSafetyError(""); }}><option value="">選択してください</option><option value="harassment">不快な言動・嫌がらせ</option><option value="identity">プロフィールや所属が不自然</option><option value="solicitation">勧誘・金銭の要求</option><option value="other">その他</option></select><label htmlFor="report-detail">補足（任意）</label><textarea id="report-detail" value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} placeholder="気になったことがあれば書いてください" rows={3} />{safetyError && <p className="field-error" role="alert">{safetyError}</p>}<button className="secondary-button full-width" onClick={submitReport}>運営に通報する <span>→</span></button></div></div>
          </section>
        </div>
      )}

      {lineModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setLineModalOpen(false)}>
          <section className="line-modal" role="dialog" aria-modal="true" aria-labelledby="line-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top"><span className="line-modal__mark">LINE</span><button className="close-button" onClick={() => setLineModalOpen(false)} aria-label="LINE登録を閉じる">×</button></div>
            <p className="eyebrow">LINE連携</p>
            {lineLinkDetail?.linked && !lineLinkDetail.followed && !localTest ? (
              <>
                <h2 id="line-modal-title">あとは、<br /><em>友だち追加だけ。</em></h2>
                <p>LINEログインは完了しています。set-mobを友だち追加すると、参加登録ができるようになります。金曜21時に、翌日の参加確認をお送りします。</p>
                {lineOfficialAccountUrl && <a className="primary-button full-width" href={lineOfficialAccountUrl} target="_blank" rel="noreferrer">set-mobを友だち追加する<span>↗</span></a>}
                <button className="secondary-button full-width" type="button" onClick={recheckLineStatus} disabled={lineRechecking}>{lineRechecking ? "状態を確認中…" : "追加したら、状態を確認する"}</button>
              </>
            ) : (
              <>
                <h2 id="line-modal-title">前日の案内を、<br /><em>LINEで受け取る。</em></h2>
                <p>参加登録には、LINEへのログインとset-mobの友だち追加が必要です。金曜21時に、翌日の参加確認をお送りします。</p>
                {lineOfficialAccountUrl && <a className="line-modal__official-link" href={lineOfficialAccountUrl} target="_blank" rel="noreferrer">set-mobを友だち追加する ↗</a>}
                <div className="line-modal__preview"><span>金曜 21:00</span><strong>明日の土曜、参加しますか？</strong><small>参加する / 今回は見送る</small></div>
                <button className="primary-button full-width" type="button" onClick={completeLineRegistration} disabled={lineConnecting}>{lineConnecting ? "LINE連携を準備中…" : localTest ? "LINE連携を完了する（デモ）" : "LINEでログインする"}<span>→</span></button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
