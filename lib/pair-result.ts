export type PairDecisionInput = {
  instagram: boolean;
  line: boolean;
  continue: boolean;
  none: boolean;
};

export type PairResult =
  | { kind: "pending"; items: []; contacts: null }
  | { kind: "ended"; items: []; contacts: null }
  | { kind: "continued"; items: ["continue"]; contacts: null }
  | { kind: "disclosed"; items: Array<"instagram" | "line">; contacts: { instagram?: string; line?: string } };

type ContactPairRow = {
  participantAId: string;
  participantBId: string;
  aInstagram: string | null;
  aLine: string | null;
  bInstagram: string | null;
  bLine: string | null;
};

function contactFor(row: ContactPairRow, userId: string, channel: "instagram" | "line") {
  const isA = row.participantAId === userId;
  return channel === "instagram"
    ? (isA ? row.aInstagram : row.bInstagram)
    : (isA ? row.aLine : row.bLine);
}

export function resolvePairResult(
  left: PairDecisionInput | undefined,
  right: PairDecisionInput | undefined,
  row: ContactPairRow,
  currentUserId: string,
): PairResult {
  if (!left || !right) return { kind: "pending", items: [], contacts: null };
  if (left.none || right.none) return { kind: "ended", items: [], contacts: null };
  if (left.continue || right.continue) {
    return left.continue && right.continue
      ? { kind: "continued", items: ["continue"], contacts: null }
      : { kind: "ended", items: [], contacts: null };
  }
  const items = (["instagram", "line"] as const).filter((channel) => (
    left[channel]
    && right[channel]
    && Boolean(contactFor(row, row.participantAId, channel))
    && Boolean(contactFor(row, row.participantBId, channel))
  ));
  if (items.length === 0) return { kind: "ended", items: [], contacts: null };
  const contacts: { instagram?: string; line?: string } = {};
  for (const channel of items) {
    const partnerId = row.participantAId === currentUserId ? row.participantBId : row.participantAId;
    const partnerContact = contactFor(row, partnerId, channel);
    if (partnerContact) contacts[channel] = partnerContact;
  }
  return { kind: "disclosed", items, contacts };
}
