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

const INVITE_URL_IN_TEXT = /https:\/\/(?:setlog\.kr|setlog\.app|newchat\.kr)\/invite\/[A-Za-z0-9]{1,120}/g;
const INVITE_CODE_IN_TEXT = /参加コード\s*[:：]\s*([A-Za-z0-9]{1,120})/;

// Finds a Setlog invitation inside free-form text, such as the message the
// Setlog share button produces:
//   日決めて、セットログ撮ろう
//   参加コード: c5kqehg https://setlog.kr/invite/c5kqehg
// A recognized /invite/<code> URL wins; a labelled 参加コード is the fallback.
// Every candidate still goes through normalizeSetlogInvite for validation.
export function extractSetlogInvite(text: unknown): { url: string; code: string } | null {
  if (typeof text !== "string") return null;
  for (const match of text.matchAll(INVITE_URL_IN_TEXT)) {
    const invite = normalizeSetlogInvite(match[0]);
    if (invite) return invite;
  }
  const codeMatch = INVITE_CODE_IN_TEXT.exec(text);
  if (codeMatch) return normalizeSetlogInvite(codeMatch[1]);
  return null;
}
