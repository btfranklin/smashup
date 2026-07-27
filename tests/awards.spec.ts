import { describe, expect, it } from "vitest";

import {
  selectWreckAwards,
  type WreckAwardSelection,
} from "../src/game/awards";

function result(
  overrides: Partial<WreckAwardSelection> = {},
): WreckAwardSelection {
  return {
    playerWon: false,
    playerEngineHealth: 1,
    playerFrontDamage: 0,
    playerKnockoutCount: 0,
    strongestPlayerHitSeverity: 0,
    strongestPlayerKnockoutSeverity: 0,
    ...overrides,
  };
}

describe("selectWreckAwards", () => {
  it("selects the highest-priority qualifying impact award", () => {
    expect(
      selectWreckAwards(
        result({
          strongestPlayerHitSeverity: 0.9,
          strongestPlayerKnockoutSeverity: 0.72,
        }),
      ),
    ).toEqual(["sledgehammer"]);
    expect(
      selectWreckAwards(result({ strongestPlayerHitSeverity: 0.48 })),
    ).toEqual(["big_swing"]);
    expect(
      selectWreckAwards(result({ strongestPlayerHitSeverity: 0.479 })),
    ).toEqual([]);
  });

  it("does not grant an impact award without player-attributed severity", () => {
    expect(
      selectWreckAwards(
        result({
          playerWon: false,
          playerKnockoutCount: 0,
          strongestPlayerHitSeverity: 0,
          strongestPlayerKnockoutSeverity: 0,
        }),
      ),
    ).toEqual([]);
  });

  it("selects one survival award only for a player win", () => {
    expect(
      selectWreckAwards(
        result({
          playerWon: true,
          playerEngineHealth: 0.36,
          playerFrontDamage: 0.9,
        }),
      ),
    ).toEqual(["running_on_fumes"]);
    expect(
      selectWreckAwards(
        result({
          playerWon: true,
          playerEngineHealth: 0.361,
          playerFrontDamage: 0.6,
        }),
      ),
    ).toEqual(["lead_with_your_chin"]);
    expect(selectWreckAwards(result({ playerWon: true }))).toEqual([
      "last_car_rolling",
    ]);
    expect(
      selectWreckAwards(
        result({ playerEngineHealth: 0.1, playerFrontDamage: 0.9 }),
      ),
    ).toEqual([]);
  });

  it("selects the knockout-count style award at each threshold", () => {
    expect(
      selectWreckAwards(result({ playerKnockoutCount: 1 })),
    ).toEqual(["finisher"]);
    expect(
      selectWreckAwards(result({ playerKnockoutCount: 2 })),
    ).toEqual(["double_trouble"]);
    expect(
      selectWreckAwards(result({ playerKnockoutCount: 3 })),
    ).toEqual(["wrecking_crew"]);
    expect(
      selectWreckAwards(result({ playerKnockoutCount: 6 })),
    ).toEqual(["wrecking_crew"]);
  });

  it("returns at most three awards in impact, survival, style order", () => {
    expect(
      selectWreckAwards(
        result({
          playerWon: true,
          playerEngineHealth: 0.2,
          playerFrontDamage: 0.8,
          playerKnockoutCount: 4,
          strongestPlayerHitSeverity: 0.95,
          strongestPlayerKnockoutSeverity: 0.8,
        }),
      ),
    ).toEqual(["sledgehammer", "running_on_fumes", "wrecking_crew"]);
  });
});
