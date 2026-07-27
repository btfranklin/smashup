import type { WreckAwardId } from "./types";

export type WreckAwardSelection = {
  playerWon: boolean;
  playerEngineHealth: number;
  playerFrontDamage: number;
  playerKnockoutCount: number;
  strongestPlayerHitSeverity: number;
  strongestPlayerKnockoutSeverity: number;
};

export function selectWreckAwards(
  result: WreckAwardSelection,
): WreckAwardId[] {
  const awardIds: WreckAwardId[] = [];

  if (result.strongestPlayerKnockoutSeverity >= 0.72) {
    awardIds.push("sledgehammer");
  } else if (result.strongestPlayerHitSeverity >= 0.48) {
    awardIds.push("big_swing");
  }

  if (result.playerWon && result.playerEngineHealth <= 0.36) {
    awardIds.push("running_on_fumes");
  } else if (result.playerWon && result.playerFrontDamage >= 0.6) {
    awardIds.push("lead_with_your_chin");
  } else if (result.playerWon) {
    awardIds.push("last_car_rolling");
  }

  if (result.playerKnockoutCount >= 3) {
    awardIds.push("wrecking_crew");
  } else if (result.playerKnockoutCount === 2) {
    awardIds.push("double_trouble");
  } else if (result.playerKnockoutCount === 1) {
    awardIds.push("finisher");
  }

  return awardIds;
}
