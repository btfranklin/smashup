import type { GameState, RoundStats } from "./types";

export function createRoundStats(startElapsed = 0): RoundStats {
  return {
    startElapsed,
    biggestHitSeverity: 0,
    biggestHitLabel: null,
    eliminatedById: null,
    knockoutReason: null,
    playerKnockouts: [],
    lastPlayerTargetId: null,
    lastPlayerTargetElapsed: null,
    finalTwoAnnounced: false,
  };
}

export function resetRoundStats(state: GameState): void {
  state.roundStats = createRoundStats(state.elapsed);
}
