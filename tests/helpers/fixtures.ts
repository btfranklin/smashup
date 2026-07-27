import { CAR_PRESETS } from "../../src/game/content";
import { PLACEMENT_POINTS } from "../../src/game/career";
import { createFreshCondition } from "../../src/game/conditions";
import { createFreshFrame } from "../../src/game/deformation";
import { createInitialState, chooseStarterCar } from "../../src/game/session";
import type {
  Car,
  CarPresetId,
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
    phases: overrides.phases ?? {
      engine: "healthy",
      radiator: "healthy",
      transmission: "healthy",
      steering: "healthy",
    },
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
