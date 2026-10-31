import { safeSecretEqual, signHmac } from "./crypto";

const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const LINE_PROFILE_URL = "https://api.line.me/v2/profile";
const LINE_BOT_PROFILE_URL = "https://api.line.me/v2/bot/profile";
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineTextMessage = { type: "text"; text: string };
export type LineMessageAction =
  | { type: "uri"; label: string; uri: string }
  | { type: "postback"; label: string; data: string; displayText?: string };
export type LineTemplateMessage = {
  type: "template";
  altText: string;
  template: { type: "buttons"; text: string; actions: LineMessageAction[] };
};
export type LineMessage = LineTextMessage | LineTemplateMessage;

function getLineConfig() {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI
    ?? `${process.env.APP_BASE_URL ?? "http://localhost:3001"}/api/line/callback`;
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!channelId || !channelSecret) throw new Error("LINE Login is not configured.");
  const messagingChannelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET ?? channelSecret;
  return { channelId, channelSecret, messagingChannelSecret, redirectUri, accessToken };
}

export function buildLineLoginUrl(state: string) {
  const { channelId, redirectUri } = getLineConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: "profile openid",
    // Show the official-account friend-add prompt inside the LINE login
    // flow, so users do not have to find the friend-add link afterwards.
    bot_prompt: "aggressive",
  });
  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeLineCode(code: string) {
  const { channelId, channelSecret, redirectUri } = getLineConfig();
  const response = await fetch(LINE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!response.ok) throw new Error(`LINE token exchange failed with status ${response.status}.`);
  return await response.json() as { access_token: string; expires_in: number; token_type: string; id_token?: string };
}

export async function getLineProfile(accessToken: string) {
  const response = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`LINE profile request failed with status ${response.status}.`);
  return await response.json() as { userId: string; displayName?: string; pictureUrl?: string };
}

export async function checkLineFriendship(lineUserId: string) {
  const { accessToken } = getLineConfig();
  if (!accessToken) return false;
  const response = await fetch(`${LINE_BOT_PROFILE_URL}/${encodeURIComponent(lineUserId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`LINE friendship request failed with status ${response.status}.`);
  return true;
}

export async function pushLineMessages(lineUserId: string, messages: LineMessage[]) {
  const { accessToken } = getLineConfig();
  if (!accessToken) throw new Error("LINE Messaging API is not configured.");
  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: lineUserId,
      messages,
    }),
  });
  if (!response.ok) throw new Error(`LINE message request failed with status ${response.status}.`);
}

export async function pushLineMessage(lineUserId: string, text: string) {
  await pushLineMessages(lineUserId, [{ type: "text", text }]);
}

export async function replyLineMessage(replyToken: string, messages: LineMessage[]) {
  const { accessToken } = getLineConfig();
  if (!accessToken) throw new Error("LINE Messaging API is not configured.");
  const response = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });
  if (!response.ok) throw new Error(`LINE reply request failed with status ${response.status}.`);
}

export async function verifyLineIdToken(idToken: string) {
  const { channelId } = getLineConfig();
  const response = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }),
  });
  if (!response.ok) throw new Error(`LINE ID token verification failed with status ${response.status}.`);
  const payload = await response.json() as { sub?: string; name?: string; email?: string };
  if (!payload.sub) throw new Error("LINE ID token verification returned no subject.");
  return { sub: payload.sub, name: payload.name, email: payload.email };
}

export function verifyLineWebhookSignature(body: string, signature: string | null) {
  const { messagingChannelSecret } = getLineConfig();
  if (!signature) return false;
  return safeSecretEqual(signHmac(body, messagingChannelSecret), signature);
}
