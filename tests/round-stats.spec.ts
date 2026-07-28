import { describe, expect, it } from "vitest";

import {
  createRoundStats,
  recordPlayerContact,
  resetRoundStats,
} from "../src/game/roundStats";
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
      playerContactLedger: {},
      strongestPlayerKnockoutSeverity: 0,
      finalTwoAnnounced: false,
      lastPlayerSystemPhases: null,
    });
  });

  it("resets round stats from the state's current elapsed time", () => {
    const state = createStateFixture({ elapsed: 18.5 });
    state.roundStats.biggestHitSeverity = 1;
    state.roundStats.biggestHitLabel = "Player into Rimshot";
    state.roundStats.playerKnockouts.push("Rimshot");
    state.roundStats.strongestPlayerHitSeverity = 0.8;
    state.roundStats.playerContactLedger[7] = {
      elapsed: 16,
      severity: 0.7,
    };
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
      playerContactLedger: {},
      strongestPlayerKnockoutSeverity: 0,
      finalTwoAnnounced: false,
      lastPlayerSystemPhases: {
        engine: "healthy",
        radiator: "healthy",
        transmission: "healthy",
        steering: "healthy",
      },
    });
  });

  it("resets without a phase cursor when the state has no player car", () => {
    const state = createStateFixture({ cars: [], playerId: 999 });

    resetRoundStats(state);

    expect(state.roundStats.lastPlayerSystemPhases).toBeNull();
  });

  it("keeps the latest damaging contact per opponent and the strongest overall hit", () => {
    const stats = createRoundStats();

    recordPlayerContact(stats, 7, 10, 0.82);
    recordPlayerContact(stats, 8, 11, 0.64);
    recordPlayerContact(stats, 7, 12, 0.38);
    recordPlayerContact(stats, 8, 13, 0);

    expect(stats.playerContactLedger).toEqual({
      7: { elapsed: 12, severity: 0.38 },
      8: { elapsed: 11, severity: 0.64 },
    });
    expect(stats.strongestPlayerHitSeverity).toBe(0.82);
  });
});
