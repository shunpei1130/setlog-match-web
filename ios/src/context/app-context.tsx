import { ApiError, mobileApi, getApiEnvironment } from "@/lib/api";
import { lineCallbackMessage, lineCallbackStatus } from "@/lib/line-callback";
import { phaseFor } from "@/lib/phase";
import { clearAccessToken, clearRegistrationDraft, readAccessToken, saveAccessToken, restoreApiEnvironment, saveApiEnvironment } from "@/lib/storage";
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
  saveInvite: (invite: string) => Promise<void>;
  confirmJoined: () => Promise<void>;
  nextEvent: () => Promise<void>;
  cancelExtension: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  reviewLogin: (username: string, password: string) => Promise<boolean>;
  reviewScenario: (scenario: string) => Promise<void>;
  isReview: boolean;
  dismissNotice: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function messageForError(error: unknown) {
  if (!(error instanceof ApiError)) return "通信できませんでした。時間をおいて、もう一度お試しください。";
  const messages: Record<string, string> = {
    AOYAMA_EMAIL_REQUIRED: "青学のメールアドレスを入力してください。",
    AUTH_CODE_INVALID: "認証コードが正しくありません。",
    AUTH_CODE_EXPIRED: "認証コードの期限が切れました。認証コードをもう一度送ってください。",
    AUTH_CODE_LOCKED: "入力回数の上限に達しました。認証コードをもう一度送ってください。",
    EVENT_FULL: "今回の募集は定員に達しました。",
    LINE_REGISTRATION_REQUIRED: "LINEを連携し、set-mobの公式アカウントを友だち追加してください。",
    INSTAGRAM_CONTACT_REQUIRED: "Instagramのユーザーネームが登録されていないため、交換できません。",
    LINE_CONTACT_REQUIRED: "LINEの連絡先が登録されていないため、交換できません。",
    PAIR_NOT_PUBLISHED: "今日の相手を確認しています。少し待ってから、もう一度確認してください。",
    EVENT_REGISTRATION_CLOSED: "今回の参加登録は締め切りました。",
    REGISTRATION_CANCELLATION_CLOSED: "開始時刻を過ぎたため、アプリからはキャンセルできません。",
    DECISION_NOT_OPEN: "回答できるのは22:00〜23:00です。",
    DECISION_CLOSED: "回答は23時で締め切りました。",
    DECISION_FINALIZED: "ふたりの回答がそろい、結果が確定したため変更できません。",
    SETLOG_INVITE_INVALID: "Setlogの招待リンクか、英数字の参加コードを入力してください。",
    SETLOG_INVITE_ALREADY_SAVED: "相手が先にコードを共有しました。最新の内容を確認してください。",
    SETLOG_INVITE_LOCKED: "相手が参加を確認したため、招待コードは変更できません。",
    SETLOG_INVITE_CLOSED: "招待コードを共有できる時間を過ぎています。",
    REVIEW_NOT_CONFIGURED: "このアプリでは審査用ログインを利用できません。",
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
  const refreshingRef = useRef<symbol | null>(null);
  const sessionEpochRef = useRef(0);
  const preferNextRef = useRef(false);
  const decisionPairIdRef = useRef<string | null>(null);

  const clearSession = useCallback(async (preserveBusy = false) => {
    const epoch = ++sessionEpochRef.current;
    refreshingRef.current = null;
    decisionPairIdRef.current = null;
    if (!preserveBusy) setBusy(false);
    tokenRef.current = null;
    await clearAccessToken();
    if (sessionEpochRef.current !== epoch) return;
    setUser(null);
    setLine(null);
    setEvent(null);
    setPair(null);
    setSetlogOpen(false);
    setPhase("landing");
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (refreshingRef.current) return;
    const request = Symbol("refresh");
    refreshingRef.current = request;
    const epoch = sessionEpochRef.current;
    if (!silent) setBusy(true);
    try {
      const token = tokenRef.current ?? await readAccessToken();
      if (sessionEpochRef.current !== epoch) return;
      if (!token) {
        setPhase((current) => current === "auth" ? current : "landing");
        return;
      }
      tokenRef.current = token;
      const [mePayload, linePayload, participation] = await Promise.all([
        mobileApi.me(token),
        mobileApi.lineStatus(token),
        mobileApi.participation(token, preferNextRef.current),
      ]);
      if (sessionEpochRef.current !== epoch || tokenRef.current !== token) return;
      setUser(mePayload.user);
      setLine(linePayload);
      setEvent(participation.event);
      setPair(participation.pair);
      const nextPhase = phaseFor(participation.event, participation.pair);
      setPhase((current) => (
        silent && current === "decision" && nextPhase === "pair"
        && participation.pair?.id === decisionPairIdRef.current
        && participation.pair?.decisionOpen
          ? current
          : nextPhase
      ));
    } catch (error) {
      if (sessionEpochRef.current !== epoch) return;
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
      } else if (!silent) {
        setNotice(messageForError(error));
        setPhase((current) => current === "booting" ? "landing" : current);
      }
    } finally {
      if (refreshingRef.current === request) {
        refreshingRef.current = null;
        if (!silent) setBusy(false);
      }
    }
  }, [clearSession]);

  useEffect(() => {
    const timeout = setTimeout(() => void restoreApiEnvironment().then(() => refresh()), 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    const shouldPoll = phase === "waiting" || phase === "pair" || phase === "decision" || phase === "result";
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
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession, refresh]);

  const register = useCallback(async (input: RegistrationInput) => {
    const token = tokenRef.current;
    if (!token) return false;
    setBusy(true);
    setNotice(null);
    try {
      await mobileApi.register(token, input, event?.eventKey);
      await refresh();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, [clearSession, refresh, event]);

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
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession, refresh]);

  const cancelRegistration = useCallback(async () => {
    const token = tokenRef.current;
    if (!token || !event) return;
    setBusy(true);
    setNotice(null);
    try {
      await mobileApi.cancelRegistration(token, event.eventKey);
      await refresh(true);
      setNotice(event.kind === "extension" ? "ふたりの日曜の参加予約を取り消しました。別の相手の紹介はありません。" : "今回の参加をキャンセルしました。開始前なら、もう一度登録できます。");
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
      const { pair: publishedPair, event: updatedEvent } = await mobileApi.participation(token, preferNextRef.current);
      setEvent(updatedEvent);
      if (!publishedPair) {
        setNotice(updatedEvent.matchingStatus === "unmatched" ? "今回は相手が見つかりませんでした。" : "開始時刻になると、ここに今日の相手が表示されます。");
        return;
      }
      setPair(publishedPair);
      setPhase(phaseFor(updatedEvent, publishedPair));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession]);

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
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession, pair]);

  const blockPair = useCallback(async () => {
    const token = tokenRef.current;
    if (!token || !pair) return;
    setBusy(true);
    try {
      await mobileApi.block(token, pair.id);
      setPair(null);
      setPhase("ended");
      setNotice("相手をブロックし、今回のやり取りを終了しました。");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession, pair]);

  const reportPair = useCallback(async (reason: string, detail: string) => {
    const token = tokenRef.current;
    if (!token || !pair) return;
    setBusy(true);
    try {
      await mobileApi.report(token, pair.id, reason, detail);
      setPair(null);
      setPhase("ended");
      setNotice("運営に通報し、今回のやり取りを終了しました。");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      else setNotice(messageForError(error));
    } finally {
      setBusy(false);
    }
  }, [clearSession, pair]);

  const signOut = useCallback(async () => {
    const token = tokenRef.current;
    setBusy(true);
    try {
      if (token) await mobileApi.signOut(token);
    } catch {
      // The local credential must still be removed when the server is unavailable.
    } finally {
      await clearSession(true);
      await saveApiEnvironment("production");
      preferNextRef.current = false;
      setBusy(false);
    }
  }, [clearSession]);

  const saveInvite = useCallback(async (invite: string) => {
    if (!tokenRef.current || !pair) return;
    setBusy(true);
    try { const result = await mobileApi.saveInvite(tokenRef.current, pair.id, invite); setPair(result.pair); setNotice("招待コードを相手に送りました。"); }
    catch (error) { setNotice(messageForError(error)); await refresh(true); }
    finally { setBusy(false); }
  }, [pair, refresh]);

  const confirmJoined = useCallback(async () => {
    if (!tokenRef.current || !pair) return;
    setBusy(true);
    try { const result = await mobileApi.confirmJoined(tokenRef.current, pair.id); setPair(result.pair); }
    catch (error) { setNotice(messageForError(error)); }
    finally { setBusy(false); }
  }, [pair]);

  const nextEvent = useCallback(async () => { preferNextRef.current = true; await refresh(); }, [refresh]);
  const cancelExtension = useCallback(async () => {
    if (!tokenRef.current || !pair?.extension) return;
    setBusy(true);
    try { await mobileApi.cancelRegistration(tokenRef.current, pair.extension.eventKey); await refresh(true); setNotice("ふたりの日曜の参加予約を取り消しました。"); }
    catch (error) { setNotice(messageForError(error)); }
    finally { setBusy(false); }
  }, [pair, refresh]);

  const deleteAccount = useCallback(async () => {
    if (!tokenRef.current) return false;
    setBusy(true);
    try {
      await mobileApi.deleteAccount(tokenRef.current);
      await clearRegistrationDraft(); await clearSession(true); await saveApiEnvironment("production");
      preferNextRef.current = false; return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      setNotice(messageForError(error)); return false;
    } finally { setBusy(false); }
  }, [clearSession]);

  const reviewLogin = useCallback(async (username: string, password: string) => {
    setBusy(true);
    try {
      await clearSession(true); await saveApiEnvironment("review");
      const result = await mobileApi.reviewLogin(username, password);
      await saveAccessToken(result.accessToken); tokenRef.current = result.accessToken;
      preferNextRef.current = false; await refresh(); return true;
    } catch (error) { await saveApiEnvironment("production"); setNotice(messageForError(error)); return false; }
    finally { setBusy(false); }
  }, [clearSession, refresh]);

  const reviewScenario = useCallback(async (scenario: string) => {
    if (!tokenRef.current) return;
    decisionPairIdRef.current = null;
    setBusy(true);
    try { await mobileApi.reviewScenario(tokenRef.current, scenario); preferNextRef.current = false; await refresh(true); }
    catch (error) { setNotice(messageForError(error)); }
    finally { setBusy(false); }
  }, [refresh]);

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
        setNotice("回答できるのは22:00〜23:00です。");
        return;
      }
      decisionPairIdRef.current = pair.id;
      setPhase("decision");
    },
    submitDecision,
    blockPair,
    reportPair,
    signOut,
    saveInvite, confirmJoined, nextEvent, cancelExtension, deleteAccount, reviewLogin, reviewScenario,
    isReview: getApiEnvironment() === "review",
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
    saveInvite, confirmJoined, nextEvent, cancelExtension, deleteAccount, reviewLogin, reviewScenario,
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
