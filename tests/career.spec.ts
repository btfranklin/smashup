import { describe, expect, it } from "vitest";

import {
  PLACEMENT_POINTS,
  buildCareerStandings,
  generateCareerRoundPlans,
  getConditionScore,
  rankRoundCars,
} from "../src/game/career";
import { createDefaultPlayerBuild } from "../src/game/content";
import { createFreshCondition } from "../src/game/conditions";
import { createRoundCars } from "../src/game/roster";
import type {
  CarPresetId,
  RoundPlacement,
  RoundSummary,
} from "../src/game/types";

function placement(
  driverId: number,
  place: number,
  points = PLACEMENT_POINTS[place - 1] ?? 0,
): RoundPlacement {
  const presetIds: CarPresetId[] = ["bulldozer", "darter", "backstab"];
  return {
    driverId,
    label: driverId === 0 ? "Player" : `Driver ${driverId}`,
    presetId: presetIds[driverId % presetIds.length],
    isPlayer: driverId === 0,
    place,
    points,
  };
}

function summary(
  roundIndex: number,
  placements: RoundPlacement[],
): RoundSummary {
  const winner = placements.find((entry) => entry.place === 1);
  return {
    roundIndex,
    title: `Round ${roundIndex + 1}`,
    playerWon: winner?.isPlayer ?? false,
    winnerLabel: winner?.label ?? null,
    survivalTime: 60,
    eliminatedByLabel: null,
    playerKnockouts: [],
    biggestHitLabel: null,
    biggestHitSeverity: 0,
    knockoutReason: null,
    placements,
    awardIds: [],
  };
}

describe("Career Night round generation", () => {
  it("is deterministic and follows the five-round modifier structure", () => {
    const plans = generateCareerRoundPlans(20260726);

    expect(generateCareerRoundPlans(20260726)).toEqual(plans);
    expect(plans.map((plan) => plan.id)).toEqual([1, 2, 3, 4, 5]);
    expect(plans.map((plan) => plan.modifier).slice(0, 2)).toEqual([
      "none",
      "none",
    ]);
    expect(new Set(plans.slice(2, 4).map((plan) => plan.modifier))).toEqual(
      new Set(["hot_engines", "lights_out"]),
    );
    expect(plans[4].modifier).toBe("redline");
    plans.forEach((plan) => {
      expect(plan.title.length).toBeGreaterThan(0);
      expect(plan.introLine.length).toBeGreaterThan(0);
    });
  });

  it("never repeats an arena consecutively but can vary across seeds", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const plans = generateCareerRoundPlans(seed);
      for (let index = 1; index < plans.length; index += 1) {
        expect(plans[index].arenaVariant).not.toBe(
          plans[index - 1].arenaVariant,
        );
      }
    }

    expect(generateCareerRoundPlans(1)).not.toEqual(
      generateCareerRoundPlans(2),
    );
  });
});

describe("round placement ranking", () => {
  it("scores pristine and fully spent conditions at the formula bounds", () => {
    const [car] = createRoundCars(
      createDefaultPlayerBuild("bulldozer"),
      createFreshCondition(),
    );
    expect(getConditionScore(car)).toBeCloseTo(1);

    car.systems.engine = 0;
    car.systems.radiator = 0;
    car.systems.transmission = 0;
    car.systems.steering = 0;
    car.systems.overheat = 1;
    car.body = { front: 1, rear: 1, left: 1, right: 1 };
    expect(getConditionScore(car)).toBe(0);
  });

  it("puts active cars first, then reverses elimination order with stable ties", () => {
    const cars = createRoundCars(
      createDefaultPlayerBuild("bulldozer"),
      createFreshCondition(),
    );
    cars.forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = index;
    });
    cars[0].disabled = false;
    cars[0].eliminationTime = null;
    cars[3].eliminationTime = 20;
    cars[4].eliminationTime = 20;
    cars[3].systems.engine = 0.2;
    cars[3].systems.radiator = 0.2;
    cars[3].systems.transmission = 0.2;
    cars[3].systems.steering = 0.2;

    const placements = rankRoundCars(cars);

    expect(placements.map((entry) => entry.driverId)).toEqual([
      0, 4, 3, 7, 6, 5, 2, 1,
    ]);
    expect(placements.map((entry) => entry.points)).toEqual(PLACEMENT_POINTS);
  });

  it("condition-ranks multiple active cars for a forced finish", () => {
    const cars = createRoundCars(
      createDefaultPlayerBuild("bulldozer"),
      createFreshCondition(),
    );
    cars.forEach((car, index) => {
      car.disabled = index > 1;
      car.eliminationTime = index > 1 ? index : null;
    });
    cars[0].systems.engine = 0.1;
    cars[0].systems.radiator = 0.1;
    cars[0].systems.transmission = 0.1;
    cars[0].systems.steering = 0.1;

    expect(rankRoundCars(cars).slice(0, 2).map((entry) => entry.driverId)).toEqual(
      [1, 0],
    );
  });
});

describe("Career Night standings", () => {
  it("builds and ranks all eight drivers from placement points", () => {
    const placements = [3, 0, 5, 1, 7, 2, 6, 4].map((driverId, index) =>
      placement(driverId, index + 1),
    );
    const standings = buildCareerStandings([summary(0, placements)]);

    expect(standings).toHaveLength(8);
    expect(standings.map((entry) => entry.driverId)).toEqual([
      3, 0, 5, 1, 7, 2, 6, 4,
    ]);
    expect(standings.map((entry) => entry.points)).toEqual(PLACEMENT_POINTS);
    expect(standings.map((entry) => entry.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(standings[1].roundPlacements).toEqual([2]);
  });

  it("breaks ties by wins, podiums, final placement, then driver id", () => {
    const wins = buildCareerStandings([
      summary(0, [placement(0, 1, 5), placement(1, 2, 5)]),
      summary(1, [placement(0, 8, 5), placement(1, 4, 5)]),
    ]);
    expect(wins.map((entry) => entry.driverId)).toEqual([0, 1]);

    const podiums = buildCareerStandings([
      summary(0, [placement(0, 2, 5), placement(1, 3, 5)]),
      summary(1, [placement(0, 8, 5), placement(1, 2, 5)]),
    ]);
    expect(podiums.map((entry) => entry.driverId)).toEqual([1, 0]);

    const finalPlacement = buildCareerStandings([
      summary(0, [placement(0, 2, 5), placement(1, 3, 5)]),
      summary(1, [placement(0, 4, 5), placement(1, 5, 5)]),
    ]);
    expect(finalPlacement.map((entry) => entry.driverId)).toEqual([0, 1]);

    const driverId = buildCareerStandings([
      summary(0, [placement(1, 4, 5), placement(0, 4, 5)]),
    ]);
    expect(driverId.map((entry) => entry.driverId)).toEqual([0, 1]);
  });
});
