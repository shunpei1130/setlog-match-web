const AOYAMA_STUDENT_EMAIL_PATTERN = /^[^@\s]+@(aoyama\.jp|aoyama\.ac\.jp)$/i;

export function normalizeAoyamaEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return AOYAMA_STUDENT_EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function isAoyamaStudentEmail(value: unknown): value is string {
  return normalizeAoyamaEmail(value) !== null;
}
