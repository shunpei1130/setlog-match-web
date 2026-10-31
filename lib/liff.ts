// LIFF_ID is a public identifier (it appears in the LIFF URL), so it is safe
// to expose to the client. It is only ever read from the environment by name.
export function getLiffId(): string | null {
  const value = process.env.LIFF_ID?.trim();
  if (!value || !/^[0-9A-Za-z_-]+$/.test(value)) return null;
  return value;
}

export function buildLiffUrl(): string | null {
  const liffId = getLiffId();
  return liffId ? `https://liff.line.me/${liffId}` : null;
}
