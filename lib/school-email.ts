const AOYAMA_STUDENT_EMAIL_PATTERN = /^[^@\s]+@(aoyama\.jp|aoyama\.ac\.jp)$/i;
const EMAIL_ADDRESS_PATTERN = /^[^@\s]+@[^@\s]+$/i;

export function normalizeEmailAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return EMAIL_ADDRESS_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeAoyamaEmail(value: unknown) {
  const normalized = normalizeEmailAddress(value);
  return normalized && AOYAMA_STUDENT_EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function isAoyamaStudentEmail(value: unknown): value is string {
  return normalizeAoyamaEmail(value) !== null;
}
