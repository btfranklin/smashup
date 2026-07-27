import type { Mode } from "./types";

export type FinishCue = "happy" | "sad";

export function getRoundResultCue(
  previousMode: Mode,
  nextMode: Mode,
  playerDisabled: boolean,
): FinishCue | null {
  if (
    previousMode === "running" &&
    nextMode === "spectating" &&
    playerDisabled
  ) {
    return "sad";
  }

  if (previousMode === "running" && nextMode === "round_results") {
    return playerDisabled ? "sad" : "happy";
  }

  return null;
}
