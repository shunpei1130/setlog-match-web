const INVITE_HOSTS = new Set(["setlog.kr", "setlog.app", "newchat.kr"]);

export function normalizeSetlogInvite(input: unknown): { url: string; code: string } | null {
  if (typeof input !== "string") return null;
  let code = input.trim().replace(/^#/, "");
  if (code.startsWith("https://")) {
    try {
      const url = new URL(code);
      if (!INVITE_HOSTS.has(url.hostname) || url.port || url.username || url.password || url.search || url.hash) return null;
      const path = /^\/invite\/([A-Za-z0-9]{1,120})\/?$/.exec(url.pathname);
      if (!path) return null;
      code = path[1];
    } catch { return null; }
  }
  if (!/^[A-Za-z0-9]{1,120}$/.test(code)) return null;
  return { url: `https://setlog.kr/invite/${code}`, code };
}
