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
import { getKnockoutCause } from "../src/game/damage";
import type { CarCondition, SessionUpgradeId } from "../src/game/types";
import {
  createCarFixture,
  createRoundSummaryFixture,
} from "./helpers/fixtures";

describe("session flow", () => {
  it("creates an initial menu state with preview cars", () => {
    const state = createInitialState();

    expect(state.mode).toBe("menu");
    expect(state.preview).toBeNull();
    expect(state.currentRoundPlan).toBeNull();
    expect(state.session.playerBuild).toBeNull();
    expect(state.cars.length).toBeGreaterThan(1);
  });

  it("creates preview states that echo the requested preset and scenario", () => {
    const state = createCarPreviewState("darter", "critical");

    expect(state.mode).toBe("car_preview");
    expect(state.currentRoundPlan).toBeNull();
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

  it("restarts mutated state back to the initial Career Night shell", () => {
    const state = createInitialState();
    chooseStarterCar(state, "backstab", 42);
    state.mode = "career_over";
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

    chooseStarterCar(state, "backstab", 42);

    expect(state.mode).toBe("intro");
    expect(state.session.playerBuild?.presetId).toBe("backstab");
    expect(state.session.runSeed).toBe(42);
    expect(state.session.roundPlans).toHaveLength(5);
    expect(state.session.roundIndex).toBe(0);
    expect(state.cars[0].presetId).toBe("backstab");
    expect(state.currentRoundPlan?.id).toBe(1);
    expect(state.events[0]?.kind).toBe("countdown");
  });

  it("applies pit upgrades and carries serviced condition into the next round", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer", 42);
    state.session.lastRoundSummary = createRoundSummaryFixture({
      survivalTime: 12,
      playerKnockouts: ["Rimshot"],
      biggestHitLabel: "Player into Rimshot",
      biggestHitSeverity: 0.9,
    });
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

  it("applies generated modifiers through the Redline finale", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer", 42);
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

    for (
      let roundIndex = 1;
      roundIndex < state.session.roundPlans.length;
      roundIndex += 1
    ) {
      state.session.lastRoundSummary = createRoundSummaryFixture({
        roundNumber: roundIndex,
      });
      state.session.playerCondition = {
        systems: { ...state.cars[0].systems },
        body: { ...state.cars[0].body },
        lights: { ...state.cars[0].lights },
      };
      applySessionUpgrade(state, "ram_rig");
      expect(state.currentRoundPlan?.modifier).toBe(
        state.session.roundPlans[roundIndex].modifier,
      );
    }

    expect(state.currentRoundPlan?.modifier).toBe("redline");
    expect(state.cars.every((car) => car.systems.overheat >= 0.55)).toBe(true);
    expect(state.cars.every((car) => car.lights.rearLeft === false)).toBe(true);
  });

  it("starts Lights Out with every light dark and no added body damage", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer", 42);
    const lightsOutIndex = state.session.roundPlans.findIndex(
      (plan) => plan.modifier === "lights_out",
    );

    expect(lightsOutIndex).toBeGreaterThan(0);

    for (let roundIndex = 1; roundIndex <= lightsOutIndex; roundIndex += 1) {
      state.session.lastRoundSummary = createRoundSummaryFixture({
        roundNumber: roundIndex,
      });
      applySessionUpgrade(state, "ram_rig");
    }

    expect(state.currentRoundPlan?.modifier).toBe("lights_out");
    expect(
      state.cars.every((car) =>
        Object.values(car.lights).every((active) => !active),
      ),
    ).toBe(true);
    expect(state.cars.every((car) => car.body.rear === 0)).toBe(true);
  });

  it("advances every non-final result to upgrades and the finale to career over", () => {
    const state = createInitialState();
    chooseStarterCar(state, "darter", 42);
    state.session.lastRoundSummary = createRoundSummaryFixture();

    advanceAfterRound(state);
    expect(state.mode).toBe("upgrade");

    state.session.lastRoundSummary = createRoundSummaryFixture({
      roundNumber: 5,
    });
    state.session.roundIndex = state.session.roundPlans.length - 1;
    advanceAfterRound(state);
    expect(state.mode).toBe("career_over");

    state.session.roundIndex = 0;
    state.session.lastRoundSummary = createRoundSummaryFixture({
      playerWon: false,
      playerWrecked: true,
      winnerLabel: "Rimshot",
      eliminatedByLabel: "Rimshot",
    });
    advanceAfterRound(state);
    expect(state.mode).toBe("upgrade");
  });

  it("tows a wreck before applying normal pit service", () => {
    const state = createInitialState();
    chooseStarterCar(state, "darter", 42);
    state.session.lastRoundSummary = createRoundSummaryFixture({
      playerWon: false,
      playerWrecked: true,
      winnerLabel: "Rimshot",
      eliminatedByLabel: "Rimshot",
    });
    const condition = state.session.playerCondition;
    if (!condition) {
      throw new Error("Player condition missing.");
    }
    condition.systems.engine = 0.04;
    condition.systems.radiator = 0.06;
    condition.systems.transmission = 0.08;
    condition.systems.steering = 0.1;
    condition.systems.overheat = 0.98;
    condition.body.front = 0.8;

    applySessionUpgrade(state, "ram_rig");

    expect(state.cars[0].systems.engine).toBeCloseTo(0.62);
    expect(state.cars[0].systems.radiator).toBeGreaterThanOrEqual(0.4);
    expect(state.cars[0].systems.overheat).toBeLessThanOrEqual(0.45);
    expect(state.cars[0].body.front).toBeCloseTo(0.66);
    expect(getKnockoutCause(state.cars[0])).toBeNull();
  });

  it("returns every upgrade to a runnable state after each knockout condition", () => {
    const upgrades: SessionUpgradeId[] = [
      "pit_patch",
      "ram_rig",
      "steering_clinic",
    ];
    const lights = {
      frontLeft: false,
      frontRight: false,
      rearLeft: false,
      rearRight: false,
    };
    const wrecks: Array<{ name: string; condition: CarCondition }> = [
      {
        name: "catastrophic front",
        condition: {
          systems: {
            engine: 0.4,
            radiator: 0.4,
            transmission: 0.4,
            steering: 0.4,
            overheat: 0,
          },
          body: { front: 0.8, rear: 0, left: 0, right: 0 },
          lights,
        },
      },
      {
        name: "thermal",
        condition: {
          systems: {
            engine: 0.9,
            radiator: 0.9,
            transmission: 0.9,
            steering: 0.9,
            overheat: 1,
          },
          body: { front: 0, rear: 0, left: 0, right: 0 },
          lights,
        },
      },
      {
        name: "system",
        condition: {
          systems: {
            engine: 0.02,
            radiator: 0.03,
            transmission: 0.05,
            steering: 0.05,
            overheat: 0,
          },
          body: { front: 0, rear: 0, left: 0, right: 0 },
          lights,
        },
      },
      {
        name: "body collapse",
        condition: {
          systems: {
            engine: 0.25,
            radiator: 0.25,
            transmission: 0.2,
            steering: 0.2,
            overheat: 0,
          },
          body: { front: 0.19, rear: 0.6, left: 0.6, right: 0.6 },
          lights,
        },
      },
    ];

    for (const wreck of wrecks) {
      expect(
        getKnockoutCause(
          createCarFixture({
            systems: { ...wreck.condition.systems },
            body: { ...wreck.condition.body },
          }),
        ),
        wreck.name,
      ).not.toBeNull();
      for (const upgrade of upgrades) {
        const state = createInitialState();
        chooseStarterCar(state, "bulldozer", 42);
        state.session.lastRoundSummary = createRoundSummaryFixture({
          playerWrecked: true,
        });
        state.session.playerCondition = {
          systems: { ...wreck.condition.systems },
          body: { ...wreck.condition.body },
          lights: { ...wreck.condition.lights },
        };

        applySessionUpgrade(state, upgrade);

        expect(
          getKnockoutCause(state.cars[0]),
          `${wreck.name} with ${upgrade}`,
        ).toBeNull();
      }
    }
  });

  it("tows a disabled first-place player but not a surviving non-winner", () => {
    const wreckedWinner = createInitialState();
    chooseStarterCar(wreckedWinner, "darter", 42);
    wreckedWinner.session.lastRoundSummary = createRoundSummaryFixture({
      playerWon: true,
      playerWrecked: true,
    });
    const wreckedCondition = wreckedWinner.session.playerCondition;
    if (!wreckedCondition) {
      throw new Error("Wrecked winner condition missing.");
    }
    wreckedCondition.systems = {
      engine: 0.04,
      radiator: 0.06,
      transmission: 0.08,
      steering: 0.1,
      overheat: 0.98,
    };

    applySessionUpgrade(wreckedWinner, "steering_clinic");

    expect(wreckedWinner.cars[0].systems.engine).toBeCloseTo(0.54);
    expect(getKnockoutCause(wreckedWinner.cars[0])).toBeNull();

    const survivingNonWinner = createInitialState();
    chooseStarterCar(survivingNonWinner, "darter", 42);
    survivingNonWinner.session.lastRoundSummary = createRoundSummaryFixture({
      playerWon: false,
      playerWrecked: false,
      winnerLabel: "Rimshot",
    });
    const survivingCondition = survivingNonWinner.session.playerCondition;
    if (!survivingCondition) {
      throw new Error("Surviving non-winner condition missing.");
    }
    survivingCondition.systems = {
      engine: 0.2,
      radiator: 0.8,
      transmission: 0.8,
      steering: 0.8,
      overheat: 0.2,
    };

    applySessionUpgrade(survivingNonWinner, "steering_clinic");

    expect(survivingNonWinner.cars[0].systems.engine).toBeCloseTo(0.28);
  });

  it("keeps mode unchanged when advancing without a round summary", () => {
    const state = createInitialState();
    beginCarSelect(state);

    advanceAfterRound(state);

    expect(state.mode).toBe("car_select");
  });

  it("ignores upgrade selection until a player condition exists", () => {
    const state = createInitialState();

    applySessionUpgrade(state, "pit_patch");

    expect(state.mode).toBe("menu");
    expect(state.session.playerBuild).toBeNull();
    expect(state.session.roundIndex).toBe(0);
  });

  it("fails loudly when a generated Career Night round is missing", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer", 42);
    state.session.roundPlans = [];

    expect(() => applySessionUpgrade(state, "pit_patch")).toThrow(
      "Career round 2 is not configured",
    );
  });
});
