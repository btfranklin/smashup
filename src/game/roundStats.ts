import { getCarSystemPhases } from "./damage";
import { getPlayerCar } from "./selectors";
import type { GameState, RoundStats } from "./types";

export function createRoundStats(startElapsed = 0): RoundStats {
  return {
    startElapsed,
    biggestHitSeverity: 0,
    biggestHitLabel: null,
    eliminatedById: null,
    playerKnockouts: [],
    strongestPlayerHitSeverity: 0,
    playerContactLedger: {},
    strongestPlayerKnockoutSeverity: 0,
    finalTwoAnnounced: false,
    lastPlayerSystemPhases: null,
  };
}

export function recordPlayerContact(
  roundStats: RoundStats,
  targetId: number,
  elapsed: number,
  severity: number,
): void {
  if (severity <= 0) {
    return;
  }
  roundStats.playerContactLedger[targetId] = { elapsed, severity };
  roundStats.strongestPlayerHitSeverity = Math.max(
    roundStats.strongestPlayerHitSeverity,
    severity,
  );
}

export function resetRoundStats(state: GameState): void {
  state.roundStats = createRoundStats(state.sessionElapsed);
  const player = getPlayerCar(state);
  state.roundStats.lastPlayerSystemPhases = player
    ? getCarSystemPhases(player)
    : null;
}
