import { ApiError, mobileApi } from "@/lib/api";
import { lineCallbackMessage, lineCallbackStatus } from "@/lib/line-callback";
import { phaseFor } from "@/lib/phase";
import { clearAccessToken, readAccessToken, saveAccessToken } from "@/lib/storage";
import type {
  AppPhase,
  EventState,
  LineStatus,
  MobileUser,
  PairDecision,
  RegistrationInput,
  RemotePair,
} from "@/types";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

WebBrowser.maybeCompleteAuthSession();

type AppContextValue = {
  phase: AppPhase;
  user: MobileUser | null;
  line: LineStatus | null;
  event: EventState | null;
  pair: RemotePair | null;
  notice: string | null;
  busy: boolean;
  setlogOpen: boolean;
  beginAuth: () => void;
  backToLanding: () => void;
  verifyCode: (email: string, code: string) => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  register: (input: RegistrationInput) => Promise<boolean>;
  cancelRegistration: () => Promise<void>;
  connectLine: () => Promise<void>;
  startMatching: () => Promise<void>;
  openSetlog: () => void;
  closeSetlog: () => void;
  openDecision: () => void;
  submitDecision: (decision: PairDecision) => Promise<void>;
  blockPair: () => Promise<void>;
  reportPair: (reason: string, detail: string) => Promise<void>;
  signOut: () => Promise<void>;
  dismissNotice: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function messageForError(error: unknown) {
  if (!(error instanceof ApiError)) return "通信に失敗しました。時間を置いてもう一度お試しください。";
  const messages: Record<string, string> = {
    AOYAMA_EMAIL_REQUIRED: "青学のメールアドレスを入力してください。",
    AUTH_CODE_INVALID: "認証コードが正しくありません。",
    AUTH_CODE_EXPIRED: "認証コードの期限が切れています。もう一度送信してください。",
    AUTH_CODE_LOCKED: "入力回数の上限に達しました。新しいコードを取得してください。",
    EVENT_FULL: "今回の募集は定員に達しました。",
    LINE_REGISTRATION_REQUIRED: "LINE Loginと友だち追加を完了してください。",
    INSTAGRAM_CONTACT_REQUIRED: "Instagramを選ぶには、事前登録でユーザーネームを設定してください。",
    LINE_CONTACT_REQUIRED: "LINEを選ぶには、事前登録で連絡先を設定してください。",
    PAIR_NOT_PUBLISHED: "運営がペアを公開するまで、もう少しお待ちください。",
    EVENT_REGISTRATION_CLOSED: "今回の参加登録は締め切りました。",
    REGISTRATION_CANCELLATION_CLOSED: "開始時刻を過ぎたため、アプリからはキャンセルできません。",
    DECISION_NOT_OPEN: "非公開判定は土曜22時から回答できます。",
  };
  return messages[error.code] ?? "処理を完了できませんでした。もう一度お試しください。";
}

export function AppProvider({ children }: PropsWithChildren) {
  const [phase, setPhase] = useState<AppPhase>("booting");
  const [user, setUser] = useState<MobileUser | null>(null);
  const [line, setLine] = useState<LineStatus | null>(null);
  const [event, setEvent] = useState<EventState | null>(null);
  const [pair, setPair] = useState<RemotePair | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setlogOpen, setSetlogOpen] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const refreshingRef = useRef(false);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    await clearAccessToken();
    setUser(null);
    setLine(null);
    setEvent(null);
    setPair(null);
    setSetlogOpen(false);
    setPhase("landing");
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (!silent) setBusy(true);
    try {
      const token = tokenRef.current ?? await readAccessToken();
      if (!token) {
        setPhase((current) => current === "auth" ? current : "landing");
        return;
      }
      tokenRef.current = token;
      const [mePayload, linePayload, eventPayload, pairPayload] = await Promise.all([
        mobileApi.me(token),
        mobileApi.lineStatus(token),
        mobileApi.event(token),
        mobileApi.pair(token),
      ]);
      setUser(mePayload.user);
      setLine(linePayload);
      setEvent(eventPayload);
      setPair(pairPayload);
      setPhase(phaseFor(eventPayload, pairPayload));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
      } else if (!silent) {
        setNotice(messageForError(error));
        setPhase((current) => current === "booting" ? "landing" : current);
      }
    } finally {
      refreshingRef.current = false;
      if (!silent) setBusy(false);
    }
  }, [clearSession]);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    const shouldPoll = phase === "waiting" || phase === "pair" || phase === "decision";
    if (!shouldPoll) return;
    const interval = setInterval(() => void refresh(true), 30_000);
    return () => clearInterval(interval);
  }, [phase, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && tokenRef.current) void refresh(true);
    });
    return () => subscription.remove();
  }, [refresh]);

  const verifyCode = useCallback(async (email: string, code: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await mobileApi.verifyCode(email, code);
      tokenRef.current = result.accessToken;
      await saveAccessToken(result.accessToken);
      await refresh();
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const register = useCallback(async (input: RegistrationInput) => {
    const token = tokenRef.current;
    if (!token) return false;
    setBusy(true);
    setNotice(null);
    try {
      await mobileApi.register(token, input);
      await refresh();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, [clearSession, refresh]);

  const connectLine = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      const login = await mobileApi.startLineLogin(token);
      const result = await WebBrowser.openAuthSessionAsync(login.authorizeUrl, login.redirectUrl);
      if (result.type !== "success") {
        setNotice("LINE連携をキャンセルしました。");
        return;
      }
      setNotice(lineCallbackMessage(lineCallbackStatus(result.url)));
      await refresh(true);
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const cancelRegistration = useCallback(async () => {
    const token = tokenRef.current;
    if (!token || !event) return;
    setBusy(true);
    setNotice(null);
    try {
      await mobileApi.cancelRegistration(token, event.eventKey);
      await refresh(true);
      setPhase("registration");
      setNotice("今回の参加をキャンセルしました。開始前なら、もう一度登録できます。");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession, event, refresh]);

  const startMatching = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      const publishedPair = await mobileApi.pair(token, event?.eventKey);
      if (!publishedPair) {
        setNotice("運営がペアを公開するまで、もう少しお待ちください。");
        return;
      }
      setPair(publishedPair);
      setPhase(phaseFor(event, publishedPair));
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [event]);

  const submitDecision = useCallback(async (decision: PairDecision) => {
    const token = tokenRef.current;
    if (!token || !pair) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await mobileApi.decision(token, pair.id, decision);
      setPair(result.pair);
      if (result.result?.kind === "pending") {
        setPhase("decision");
        setNotice("回答を受け付けました。相手の回答を待っています。");
      } else {
        setPhase("result");
      }
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [pair]);

  const blockPair = useCallback(async () => {
    const token = tokenRef.current;
    if (!token || !pair) return;
    setBusy(true);
    try {
      await mobileApi.block(token, pair.id);
      setPair(null);
      setPhase("ended");
      setNotice("相手をブロックし、このDay Pairを終了しました。");
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [pair]);

  const reportPair = useCallback(async (reason: string, detail: string) => {
    const token = tokenRef.current;
    if (!token || !pair) return;
    setBusy(true);
    try {
      await mobileApi.report(token, pair.id, reason, detail);
      setPair(null);
      setPhase("ended");
      setNotice("運営へ通報し、このDay Pairを終了しました。");
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [pair]);

  const signOut = useCallback(async () => {
    const token = tokenRef.current;
    setBusy(true);
    try {
      if (token) await mobileApi.signOut(token);
    } catch {
      // The local credential must still be removed when the server is unavailable.
    } finally {
      await clearSession();
      setBusy(false);
    }
  }, [clearSession]);

  const value = useMemo<AppContextValue>(() => ({
    phase,
    user,
    line,
    event,
    pair,
    notice,
    busy,
    setlogOpen,
    beginAuth: () => { setNotice(null); setPhase("auth"); },
    backToLanding: () => { setNotice(null); setPhase("landing"); },
    verifyCode,
    refresh,
    register,
    cancelRegistration,
    connectLine,
    startMatching,
    openSetlog: () => setSetlogOpen(true),
    closeSetlog: () => setSetlogOpen(false),
    openDecision: () => {
      if (!pair?.decisionOpen) {
        setNotice("非公開判定は土曜22時から回答できます。");
        return;
      }
      setPhase("decision");
    },
    submitDecision,
    blockPair,
    reportPair,
    signOut,
    dismissNotice: () => setNotice(null),
  }), [
    blockPair,
    busy,
    cancelRegistration,
    connectLine,
    event,
    line,
    notice,
    pair,
    phase,
    refresh,
    register,
    reportPair,
    setlogOpen,
    signOut,
    startMatching,
    submitDecision,
    user,
    verifyCode,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
