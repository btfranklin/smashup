import { CAR_PRESETS } from "../../src/game/content";
import type { CarPresetId } from "../../src/game/contentIds";
import {
  generateCareerRoundPlans,
  PLACEMENT_POINTS,
} from "../../src/game/career";
import { createFreshCondition } from "../../src/game/conditions";
import { createFreshFrame } from "../../src/game/deformation";
import { isActiveCareerMode } from "../../src/game/selectors";
import { createInitialState, chooseStarterCar } from "../../src/game/session";
import type {
  Car,
  CollisionEvent,
  GameState,
  RoundSummary,
} from "../../src/game/types";

let nextCarId = 100;

export function createCarFixture(
  overrides: Partial<Car> = {},
  presetId: CarPresetId = "bulldozer",
): Car {
  const preset = CAR_PRESETS[presetId];
  const condition = createFreshCondition();
  const car: Car = {
    id: nextCarId++,
    label: overrides.label ?? `${preset.title} Test`,
    isPlayer: overrides.isPlayer ?? false,
    team: overrides.team ?? "right",
    color: overrides.color ?? preset.color,
    accent: overrides.accent ?? preset.accent,
    roofNumber: overrides.roofNumber ?? "99",
    presetId,
    aiArchetype: overrides.aiArchetype ?? "bruiser",
    x: overrides.x ?? 500,
    y: overrides.y ?? 500,
    angle: overrides.angle ?? 0,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    angularVelocity: overrides.angularVelocity ?? 0,
    width: overrides.width ?? preset.width,
    length: overrides.length ?? preset.length,
    mass: overrides.mass ?? preset.mass,
    controls: overrides.controls ?? { steer: 0, forward: 0, reverse: 0 },
    driveInput: overrides.driveInput ?? 0,
    steerAngle: overrides.steerAngle ?? 0,
    steerAngleTarget: overrides.steerAngleTarget ?? 0,
    wheelbase: overrides.wheelbase ?? preset.wheelbase,
    engineForce: overrides.engineForce ?? preset.engineForce,
    brakeForce: overrides.brakeForce ?? preset.brakeForce,
    reverseForce: overrides.reverseForce ?? preset.reverseForce,
    forwardMaxSpeed: overrides.forwardMaxSpeed ?? preset.forwardMaxSpeed,
    reverseMaxSpeed: overrides.reverseMaxSpeed ?? preset.reverseMaxSpeed,
    steeringSharpness: overrides.steeringSharpness ?? preset.steeringSharpness,
    bodyArmor: overrides.bodyArmor ?? preset.bodyArmor,
    frontArmor: overrides.frontArmor ?? preset.frontArmor,
    tractionBias: overrides.tractionBias ?? preset.tractionBias,
    engineTone: overrides.engineTone ?? preset.engineTone,
    systems: overrides.systems ?? { ...condition.systems },
    body: overrides.body ?? { ...condition.body },
    frame: overrides.frame ?? createFreshFrame(preset.length, preset.width),
    lights: overrides.lights ?? { ...condition.lights },
    disabled: overrides.disabled ?? false,
    eliminationTime: overrides.eliminationTime ?? null,
    slipAmount: overrides.slipAmount ?? 0,
    aiState: overrides.aiState ?? {
      targetId: null,
      jamTimer: 0,
      resetTimer: 0,
    },
    smokeTimer: overrides.smokeTimer ?? 0,
    smokeBurstCount: overrides.smokeBurstCount ?? 0,
  };
  return { ...car, ...overrides };
}

export function createCollisionFixture(
  overrides: Partial<CollisionEvent> = {},
): CollisionEvent {
  return {
    aId: overrides.aId ?? 1,
    bId: overrides.bId ?? 2,
    aActiveAtImpact: overrides.aActiveAtImpact ?? true,
    bActiveAtImpact: overrides.bActiveAtImpact ?? true,
    aDisabledByImpact: overrides.aDisabledByImpact ?? false,
    bDisabledByImpact: overrides.bDisabledByImpact ?? false,
    point: overrides.point ?? { x: 500, y: 500 },
    pointA: overrides.pointA ?? overrides.point ?? { x: 494, y: 500 },
    pointB: overrides.pointB ?? overrides.point ?? { x: 506, y: 500 },
    normal: overrides.normal ?? { x: 1, y: 0 },
    severity: overrides.severity ?? 0.8,
    damageSeverity: overrides.damageSeverity ?? 0.6,
    damageTakenA: overrides.damageTakenA ?? overrides.damageSeverity ?? 0.6,
    damageTakenB: overrides.damageTakenB ?? overrides.damageSeverity ?? 0.6,
    zoneA: overrides.zoneA ?? "front",
    zoneB: overrides.zoneB ?? "rear",
    deformationA: overrides.deformationA ?? 0.08,
    deformationB: overrides.deformationB ?? 0.1,
  };
}

export function createStateFixture(
  overrides: Partial<GameState> = {},
): GameState {
  const state = createInitialState();
  const mode = overrides.mode ?? state.mode;
  if (
    overrides.currentRoundPlan === undefined &&
    isActiveCareerMode(mode)
  ) {
    const roundPlan = generateCareerRoundPlans(0)[0];
    state.currentRoundPlan = roundPlan;
    state.session.roundPlans = [roundPlan];
  }
  if (overrides.cars) {
    state.cars = overrides.cars;
  }
  return {
    ...state,
    ...overrides,
    arena: {
      ...state.arena,
      ...overrides.arena,
    },
    session: {
      ...state.session,
      ...overrides.session,
    },
    camera: {
      ...state.camera,
      ...overrides.camera,
    },
    roundStats: {
      ...state.roundStats,
      ...overrides.roundStats,
    },
  };
}

export function createRunningState(
  presetId: CarPresetId = "bulldozer",
): GameState {
  const state = createInitialState();
  chooseStarterCar(state, presetId);
  state.mode = "running";
  state.session.countdown = 0;
  state.events = [];
  return state;
}

export function createSaturatedRenderState(): GameState {
  const state = createRunningState();
  for (const [carIndex, car] of state.cars.entries()) {
    car.body = {
      front: 0.72,
      rear: 0.64,
      left: 0.58,
      right: 0.54,
    };
    car.frame.crush = {
      front: 0.32,
      rear: 0.28,
      left: 0.24,
      right: 0.22,
    };
    car.frame.scars = Array.from({ length: 42 }, (_, scarIndex) => ({
      id: scarIndex + 1,
      x: -car.length * 0.32 + (scarIndex % 7) * (car.length * 0.1),
      y: -car.width * 0.32 + (scarIndex % 6) * (car.width * 0.12),
      angle: ((scarIndex + carIndex) % 8) * 0.34,
      length: 5 + (scarIndex % 5) * 1.6,
      depth: 0.45 + (scarIndex % 4) * 0.12,
      width: 1.2 + (scarIndex % 3) * 0.55,
    }));
    car.frame.nextScarId = 43;
  }

  state.smokePuffs = Array.from({ length: 180 }, (_, index) => ({
    id: index + 1,
    sourceCarId: state.cars[index % state.cars.length].id,
    x: 120 + (index % 18) * 68,
    y: 120 + Math.floor(index / 18) * 62,
    vx: 0,
    vy: 0,
    age: (index % 16) / 20,
    ttl: 1,
    size: 8 + (index % 5) * 2,
    density: [0.25, 0.5, 0.75, 1][index % 4],
    flame: index % 3 === 0 ? 0.75 : 0,
  }));
  state.nextSmokePuffId = 181;

  state.dustPuffs = Array.from({ length: 180 }, (_, index) => ({
    id: index + 1,
    x: 110 + (index % 20) * 64,
    y: 100 + Math.floor(index / 20) * 70,
    vx: 0,
    vy: 0,
    age: (index % 8) * 0.08,
    ttl: 1.2,
    size: 7 + (index % 6),
    alpha: 0.55,
    tone: 0.72 + (index % 4) * 0.08,
  }));
  state.nextDustPuffId = 181;

  state.debrisParticles = Array.from({ length: 220 }, (_, index) => ({
    id: index + 1,
    x: 100 + (index % 22) * 58,
    y: 110 + Math.floor(index / 22) * 62,
    vx: 0,
    vy: 0,
    age: (index % 7) * 0.07,
    ttl: 1.1,
    size: 3 + (index % 6),
    rotation: (index % 12) * 0.2,
    spin: 0,
    tone: 0.65 + (index % 5) * 0.07,
  }));
  state.nextDebrisParticleId = 221;

  state.carFragments = Array.from({ length: 220 }, (_, index) => {
    const radius = 3 + (index % 5);
    return {
      id: index + 1,
      sourceCarId: state.cars[index % state.cars.length].id,
      x: 105 + (index % 22) * 58,
      y: 115 + Math.floor(index / 22) * 61,
      vx: 0,
      vy: 0,
      radius,
      mass: 18 + radius * 4,
      rotation: (index % 10) * 0.18,
      spin: 0,
      color: index % 2 === 0 ? "#725a46" : "#50627a",
      edgeColor: "#1c1714",
      points: [
        { x: -radius, y: -radius * 0.55 },
        { x: radius * 0.8, y: -radius * 0.7 },
        { x: radius * 0.45, y: radius },
        { x: -radius * 0.65, y: radius * 0.6 },
      ],
    };
  });
  state.nextCarFragmentId = 221;

  return state;
}

export function getPlayerFixture(state: GameState): Car {
  const player = state.cars.find((car) => car.id === state.playerId);
  if (!player) {
    throw new Error("Player car missing from fixture state.");
  }
  return player;
}

export function createRoundSummaryFixture(
  overrides: Partial<RoundSummary> = {},
): RoundSummary {
  return {
    roundNumber: 1,
    title: "Dust Bowl",
    playerWon: true,
    playerWrecked: false,
    winnerLabel: "Player",
    survivalTime: 10,
    eliminatedByLabel: null,
    playerKnockouts: [],
    biggestHitLabel: null,
    biggestHitSeverity: 0,
    knockoutReason: null,
    placements: [
      {
        driverId: 0,
        label: "Player",
        presetId: "bulldozer",
        isPlayer: true,
        place: 1,
        points: PLACEMENT_POINTS[0],
      },
      {
        driverId: 1,
        label: "Rimshot",
        presetId: "bulldozer",
        isPlayer: false,
        place: 2,
        points: PLACEMENT_POINTS[1],
      },
    ],
    awardIds: [],
    ...overrides,
  };
}
