import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function hashSecret(value: string) {
  const pepper = process.env.AUTH_SECRET_PEPPER;
  if (!pepper && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET_PEPPER is required in production.");
  }
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export function generateAuthCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function generateStateToken() {
  return randomBytes(24).toString("base64url");
}

export function safeSecretEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function signHmac(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

export const AUTH_CODE_TTL_SECONDS = 10 * 60;
export const AUTH_CODE_RESEND_SECONDS = 60;
export const AUTH_CODE_MAX_ATTEMPTS = 5;
export const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
