import { isAoyamaStudentEmail, normalizeEmailAddress } from "./school-email";

const AUTH_EMAIL_EXCEPTIONS_ENV = "AUTH_EMAIL_EXCEPTIONS";

function configuredAuthEmailExceptions() {
  return new Set(
    (process.env[AUTH_EMAIL_EXCEPTIONS_ENV] ?? "")
      .split(",")
      .map((value) => normalizeEmailAddress(value))
      .filter((value): value is string => value !== null),
  );
}

export function normalizeAllowedAuthEmail(value: unknown) {
  const normalized = normalizeEmailAddress(value);
  if (!normalized) return null;
  if (isAoyamaStudentEmail(normalized)) return normalized;
  return configuredAuthEmailExceptions().has(normalized) ? normalized : null;
}

export function isAllowedAuthEmail(value: unknown): value is string {
  return normalizeAllowedAuthEmail(value) !== null;
}
