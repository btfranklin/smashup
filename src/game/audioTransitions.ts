import type { Mode } from "./types";

export type FinishCue = "happy" | "sad";

export function getRoundResultCue(
  previousMode: Mode,
  nextMode: Mode,
  playerDisabled: boolean,
): FinishCue | null {
  if (previousMode !== "running" || nextMode !== "round_results") {
    return null;
  }

  return playerDisabled ? "sad" : "happy";
}
