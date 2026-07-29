import {
  ARENA_DEFINITIONS,
  ROUND_MODIFIER_DEFINITIONS,
} from "./content";
import {
  ARENA_VARIANT_IDS,
  type RoundModifierId,
} from "./contentIds";
import { getEngineHealth } from "./damage";
import type {
  Car,
  CareerStanding,
  RoundPlacement,
  RoundPlan,
  RoundSummary,
} from "./types";

export const PLACEMENT_POINTS = Object.freeze([10, 8, 6, 5, 4, 3, 2, 1]);

export const CAREER_ROUND_BLUEPRINT = Object.freeze([
  "none",
  "none",
  "special",
  "special",
  "redline",
] as const);

export const CAREER_ROUND_COUNT = CAREER_ROUND_BLUEPRINT.length;

function createSeededRandom(seed: number): () => number {
  let state = Math.trunc(seed) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRoundPlan(
  id: number,
  arenaVariant: RoundPlan["arenaVariant"],
  modifier: RoundModifierId,
): RoundPlan {
  const arena = ARENA_DEFINITIONS[arenaVariant];
  const modifierContent = ROUND_MODIFIER_DEFINITIONS[modifier];

  return {
    id,
    title:
      modifier === "none"
        ? arena.title
        : `${arena.title}: ${modifierContent.title}`,
    introLine: `${arena.introLine} ${modifierContent.introLine}`,
    arenaVariant,
    modifier,
  };
}

export function generateCareerRoundPlans(seed: number): RoundPlan[] {
  const random = createSeededRandom(seed);
  const specialModifiers: RoundModifierId[] =
    random() < 0.5
      ? ["hot_engines", "lights_out"]
      : ["lights_out", "hot_engines"];
  const modifiers = CAREER_ROUND_BLUEPRINT.map((slot) =>
    slot === "special" ? specialModifiers.shift()! : slot,
  );
  let previousArena: RoundPlan["arenaVariant"] | null = null;

  return modifiers.map((modifier, index) => {
    const candidates = ARENA_VARIANT_IDS.filter(
      (arenaVariant) => arenaVariant !== previousArena,
    );
    const selected =
      candidates[Math.floor(random() * candidates.length)] ??
      ARENA_VARIANT_IDS[0];
    previousArena = selected;
    return buildRoundPlan(index + 1, selected, modifier);
  });
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getConditionScore(car: Car): number {
  const averageBodyDamage =
    (car.body.front + car.body.rear + car.body.left + car.body.right) / 4;
  return (
    clampUnit(getEngineHealth(car)) * 0.55 +
    (1 - clampUnit(averageBodyDamage)) * 0.3 +
    (1 - clampUnit(car.systems.overheat)) * 0.15
  );
}

function compareConditionThenId(a: Car, b: Car): number {
  return getConditionScore(b) - getConditionScore(a) || a.id - b.id;
}

export function rankRoundCars(
  cars: readonly Car[],
): RoundPlacement[] {
  const activeCars = cars.filter((car) => !car.disabled);
  activeCars.sort(
    activeCars.length > 1
      ? compareConditionThenId
      : (a, b) => a.id - b.id,
  );
  const disabledCars = cars
    .filter((car) => car.disabled)
    .sort((a, b) => {
      const eliminationDifference =
        (b.eliminationTime ?? -1) - (a.eliminationTime ?? -1);
      return eliminationDifference || compareConditionThenId(a, b);
    });

  return [...activeCars, ...disabledCars].map((car, index) => ({
    driverId: car.id,
    label: car.label,
    presetId: car.presetId,
    isPlayer: car.isPlayer,
    place: index + 1,
    points: PLACEMENT_POINTS[index] ?? 0,
  }));
}

type MutableCareerStanding = Omit<CareerStanding, "rank">;

export function buildCareerStandings(
  completedRounds: readonly RoundSummary[],
): CareerStanding[] {
  const orderedRounds = [...completedRounds].sort(
    (a, b) => a.roundNumber - b.roundNumber,
  );
  const driverIds = new Set<number>();

  for (const round of orderedRounds) {
    for (const placement of round.placements) {
      driverIds.add(placement.driverId);
    }
  }

  const standings: MutableCareerStanding[] = [...driverIds].map((driverId) => {
    const placements = orderedRounds.map((round) =>
      round.placements.find((placement) => placement.driverId === driverId),
    );
    const identity = placements.find(
      (placement): placement is RoundPlacement => placement !== undefined,
    );

    if (!identity) {
      throw new Error(`Missing placement identity for driver ${driverId}.`);
    }

    return {
      driverId,
      label: identity.label,
      presetId: identity.presetId,
      isPlayer: identity.isPlayer,
      points: placements.reduce(
        (total, placement) => total + (placement?.points ?? 0),
        0,
      ),
      wins: placements.filter((placement) => placement?.place === 1).length,
      podiums: placements.filter(
        (placement) => placement !== undefined && placement.place <= 3,
      ).length,
      roundPlacements: placements.map((placement) => placement?.place ?? 0),
    };
  });

  standings.sort((a, b) => {
    const finalPlacementA =
      a.roundPlacements[a.roundPlacements.length - 1] || Number.POSITIVE_INFINITY;
    const finalPlacementB =
      b.roundPlacements[b.roundPlacements.length - 1] || Number.POSITIVE_INFINITY;
    return (
      b.points - a.points ||
      b.wins - a.wins ||
      b.podiums - a.podiums ||
      finalPlacementA - finalPlacementB ||
      a.driverId - b.driverId
    );
  });

  return standings.map((standing, index) => ({
    ...standing,
    rank: index + 1,
  }));
}
