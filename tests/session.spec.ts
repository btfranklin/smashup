import { describe, expect, it } from "vitest";

import {
  advanceAfterRound,
  applySessionUpgrade,
  beginCarSelect,
  chooseStarterCar,
  createCarPreviewState,
  createInitialState,
  restartState,
} from "../src/game/session";
import { CAR_PREVIEW_SCENARIOS } from "../src/game/content";

describe("session flow", () => {
  it("creates an initial menu state with preview cars", () => {
    const state = createInitialState();

    expect(state.mode).toBe("menu");
    expect(state.preview).toBeNull();
    expect(state.session.playerBuild).toBeNull();
    expect(state.cars.length).toBeGreaterThan(1);
  });

  it("creates preview states that echo the requested preset and scenario", () => {
    const state = createCarPreviewState("darter", "critical");

    expect(state.mode).toBe("car_preview");
    expect(state.preview).toEqual({
      kind: "car",
      presetId: "darter",
      scenario: "critical",
    });
    expect(state.cars).toHaveLength(1);
    expect(state.cars[0].presetId).toBe("darter");
    expect(state.smokePuffs.length).toBe(
      CAR_PREVIEW_SCENARIOS.critical.smoke?.count ?? 0,
    );
  });

  it("restarts mutated state back to the initial tournament shell", () => {
    const state = createInitialState();
    chooseStarterCar(state, "backstab");
    state.mode = "tournament_over";
    state.events.push({
      id: 999,
      text: "Test",
      kind: "warning",
      ttl: 1,
      emphasis: 1,
    });

    restartState(state);

    expect(state.mode).toBe("menu");
    expect(state.events).toEqual([]);
    expect(state.session.playerBuild).toBeNull();
    expect(state.cars.length).toBeGreaterThan(1);
  });

  it("starts car selection and prepares round one with the chosen preset", () => {
    const state = createInitialState();

    beginCarSelect(state);
    expect(state.mode).toBe("car_select");

    chooseStarterCar(state, "backstab");

    expect(state.mode).toBe("intro");
    expect(state.session.playerBuild?.presetId).toBe("backstab");
    expect(state.session.roundIndex).toBe(0);
    expect(state.cars[0].presetId).toBe("backstab");
    expect(state.session.roundPlan?.id).toBe(1);
    expect(state.events[0]?.kind).toBe("countdown");
  });

  it("applies pit upgrades and carries serviced condition into the next round", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer");
    state.session.lastRoundSummary = {
      roundIndex: 1,
      title: "Dust Bowl",
      playerWon: true,
      winnerLabel: "Player",
      survivalTime: 12,
      eliminatedByLabel: null,
      playerKnockouts: ["Rimshot"],
      biggestHitLabel: "Player into Rimshot",
      biggestHitSeverity: 0.9,
      knockoutReason: null,
    };
    state.session.playerCondition = {
      systems: {
        engine: 0.4,
        radiator: 0.35,
        transmission: 0.5,
        steering: 0.45,
        overheat: 0.7,
      },
      body: {
        front: 0.4,
        rear: 0.3,
        left: 0.2,
        right: 0.2,
      },
      lights: {
        frontLeft: false,
        frontRight: false,
        rearLeft: false,
        rearRight: false,
      },
    };

    applySessionUpgrade(state, "pit_patch");

    expect(state.session.roundIndex).toBe(1);
    expect(state.mode).toBe("intro");
    expect(state.session.playerBuild?.coolingBonus).toBeCloseTo(0.05);
    expect(state.cars[0].systems.radiator).toBeGreaterThan(0.35);
    expect(state.cars[0].body.front).toBeLessThan(0.4);
    expect(state.cars[0].lights.frontLeft).toBe(true);
    expect(state.session.lastRoundSummary).toBeNull();
    expect(state.roundStats.biggestHitSeverity).toBe(0);
  });

  it("applies round modifiers when preparing later heats", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer");
    state.session.playerCondition = state.session.playerCondition ?? {
      systems: {
        engine: 1,
        radiator: 1,
        transmission: 1,
        steering: 1,
        overheat: 0,
      },
      body: { front: 0, rear: 0, left: 0, right: 0 },
      lights: {
        frontLeft: true,
        frontRight: true,
        rearLeft: true,
        rearRight: true,
      },
    };

    applySessionUpgrade(state, "ram_rig");
    expect(state.arena.modifier).toBe("hot_engines");
    expect(state.cars.every((car) => car.systems.overheat >= 0.4)).toBe(true);

    state.session.playerCondition = {
      systems: { ...state.cars[0].systems },
      body: { ...state.cars[0].body },
      lights: { ...state.cars[0].lights },
    };
    applySessionUpgrade(state, "steering_clinic");
    expect(state.arena.modifier).toBe("lights_out");
    expect(state.cars.every((car) => car.lights.rearLeft === false)).toBe(true);
  });

  it("advances winning runs to upgrades and losing/final runs to tournament over", () => {
    const state = createInitialState();
    chooseStarterCar(state, "darter");
    state.session.lastRoundSummary = {
      roundIndex: 1,
      title: "Dust Bowl",
      playerWon: true,
      winnerLabel: "Player",
      survivalTime: 10,
      eliminatedByLabel: null,
      playerKnockouts: [],
      biggestHitLabel: null,
      biggestHitSeverity: 0,
      knockoutReason: null,
    };

    advanceAfterRound(state);
    expect(state.mode).toBe("upgrade");

    state.session.lastRoundSummary = {
      ...state.session.lastRoundSummary,
      roundIndex: 3,
      playerWon: true,
    };
    state.session.roundIndex = state.session.totalRounds - 1;
    advanceAfterRound(state);
    expect(state.mode).toBe("tournament_over");

    state.session.roundIndex = 0;
    state.session.lastRoundSummary = {
      ...state.session.lastRoundSummary,
      roundIndex: 1,
      playerWon: false,
      eliminatedByLabel: "Rimshot",
    };
    advanceAfterRound(state);
    expect(state.mode).toBe("tournament_over");
  });
});
