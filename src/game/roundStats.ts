import type { GameState, RoundStats } from "./types";

export function createRoundStats(startElapsed = 0): RoundStats {
  return {
    startElapsed,
    biggestHitSeverity: 0,
    biggestHitLabel: null,
    eliminatedById: null,
    knockoutReason: null,
    playerKnockouts: [],
    strongestPlayerHitSeverity: 0,
    lastPlayerTargetId: null,
    lastPlayerTargetElapsed: null,
    lastPlayerTargetSeverity: 0,
    strongestPlayerKnockoutSeverity: 0,
    finalTwoAnnounced: false,
  };
}

export function resetRoundStats(state: GameState): void {
  state.roundStats = createRoundStats(state.elapsed);
}
