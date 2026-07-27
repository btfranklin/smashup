import { describe, expect, it } from "vitest";

import { createRoundStats, resetRoundStats } from "../src/game/roundStats";
import { createStateFixture } from "./helpers/fixtures";

describe("round stats helpers", () => {
  it("creates default round stats with empty hit and knockout state", () => {
    expect(createRoundStats()).toEqual({
      startElapsed: 0,
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
    });
  });

  it("resets round stats from the state's current elapsed time", () => {
    const state = createStateFixture({ elapsed: 18.5 });
    state.roundStats.biggestHitSeverity = 1;
    state.roundStats.biggestHitLabel = "Player into Rimshot";
    state.roundStats.playerKnockouts.push("Rimshot");
    state.roundStats.strongestPlayerHitSeverity = 0.8;
    state.roundStats.lastPlayerTargetId = 7;
    state.roundStats.lastPlayerTargetElapsed = 16;
    state.roundStats.lastPlayerTargetSeverity = 0.7;
    state.roundStats.strongestPlayerKnockoutSeverity = 0.7;
    state.roundStats.finalTwoAnnounced = true;

    resetRoundStats(state);

    expect(state.roundStats).toEqual({
      startElapsed: 18.5,
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
    });
  });
});
