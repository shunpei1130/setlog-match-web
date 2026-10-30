import type { AppPhase, EventState, RemotePair } from "@/types";

export function phaseFor(event: EventState | null, pair: RemotePair | null): AppPhase {
  if (event?.matchingStatus === "ended") return "ended";
  if (pair?.result && pair.result.kind !== "pending") return "result";
  if (pair?.decision?.answered || pair?.result?.kind === "pending") return "decision";
  if (pair) return "pair";
  return event?.registration?.status === "waiting" ? "waiting" : "registration";
}
