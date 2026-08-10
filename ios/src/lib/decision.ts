import type { DecisionOption, PairDecision } from "@/types";

export const emptyDecision: PairDecision = {
  instagram: false,
  line: false,
  continue: false,
  none: false,
  answered: false,
};

export function toggleDecision(current: PairDecision, option: DecisionOption): PairDecision {
  if (option === "none") {
    return {
      ...emptyDecision,
      none: !current.none,
    };
  }
  return {
    ...current,
    [option]: !current[option],
    none: false,
    answered: false,
  };
}

export function hasDecision(decision: PairDecision) {
  return decision.instagram || decision.line || decision.continue || decision.none;
}
