import type {
  EventState,
  LineStatus,
  MobileUser,
  PairDecision,
  PairResult,
  RegistrationInput,
  RemotePair,
} from "@/types";

const EVENT_KEY = "next-saturday";
const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
export const API_BASE_URL = rawBaseUrl.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? "REQUEST_FAILED");
  }
  if (!payload) throw new ApiError(response.status, "INVALID_RESPONSE");
  return payload;
}

export const mobileApi = {
  requestCode(email: string) {
    return apiRequest<{ sent: true; expiresIn: number; retryAfter?: number }>("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  verifyCode(email: string, code: string) {
    return apiRequest<{
      authenticated: true;
      accessToken: string;
      expiresAt: string;
      user: { id: string; email: string; lineFollowed: boolean };
    }>("/api/mobile/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  },

  me(token: string) {
    return apiRequest<{ authenticated: true; user: MobileUser }>("/api/mobile/me", {}, token);
  },

  lineStatus(token: string) {
    return apiRequest<LineStatus>("/api/line/status", {}, token);
  },

  event(token: string, eventKey = EVENT_KEY) {
    return apiRequest<EventState>(`/api/events/${encodeURIComponent(eventKey)}/registrations`, {}, token);
  },

  register(token: string, input: RegistrationInput) {
    return apiRequest<EventState & { registered: boolean }>(`/api/events/${EVENT_KEY}/registrations`, {
      method: "POST",
      body: JSON.stringify(input),
    }, token);
  },

  cancelRegistration(token: string, eventKey: string) {
    return apiRequest<EventState & { cancelled: boolean }>(
      `/api/events/${encodeURIComponent(eventKey)}/registrations`,
      { method: "DELETE" },
      token,
    );
  },

  async pair(token: string, eventKey = EVENT_KEY) {
    try {
      const payload = await apiRequest<{ pair: RemotePair }>(`/api/events/${encodeURIComponent(eventKey)}/pair`, {}, token);
      return payload.pair;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  pairById(token: string, pairId: string) {
    return apiRequest<{ pair: RemotePair }>(`/api/pairs/${encodeURIComponent(pairId)}`, {}, token);
  },

  decision(token: string, pairId: string, decision: PairDecision) {
    return apiRequest<{ pair: RemotePair; result: PairResult | null }>(
      `/api/pairs/${encodeURIComponent(pairId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          instagram: decision.instagram,
          line: decision.line,
          continue: decision.continue,
          none: decision.none,
        }),
      },
      token,
    );
  },

  block(token: string, pairId: string) {
    return apiRequest<{ blocked: true }>(`/api/pairs/${encodeURIComponent(pairId)}/block`, {
      method: "POST",
    }, token);
  },

  report(token: string, pairId: string, reason: string, detail: string) {
    return apiRequest<{ reported: true }>(`/api/pairs/${encodeURIComponent(pairId)}/report`, {
      method: "POST",
      body: JSON.stringify({ reason, detail }),
    }, token);
  },

  startLineLogin(token: string) {
    return apiRequest<{ authorizeUrl: string; redirectUrl: string; expiresAt: string }>(
      "/api/mobile/line/login",
      { method: "POST" },
      token,
    );
  },

  signOut(token: string) {
    return apiRequest<{ signedOut: true }>("/api/mobile/auth/sign-out", { method: "POST" }, token);
  },
};
