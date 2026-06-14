import {
  CAR_PREVIEW_SCENARIOS,
  CAR_PRESETS,
  ROUND_PLANS,
  TOTAL_ROUNDS,
  createDefaultPlayerBuild,
  getArenaMudZones,
  getArenaObjects,
} from "./content";
import { cloneCondition, createFreshCondition } from "./conditions";
import { getCarSystemPhases } from "./damage";
import { createRoundStats, pushEvent, resetRoundStats } from "./runtime";
import type {
  AIArchetype,
  Car,
  CarCondition,
  CarPreviewScenarioId,
  CarPresetId,
  GameState,
  PlayerBuild,
  RoundPlan,
  SessionUpgradeId,
} from "./types";

const LEFT_LINEUP = [
  { x: 220, y: 170 },
  { x: 220, y: 355 },
  { x: 220, y: 540 },
  { x: 220, y: 725 },
];

const RIGHT_LINEUP = [
  { x: 1280, y: 170 },
  { x: 1280, y: 355 },
  { x: 1280, y: 540 },
  { x: 1280, y: 725 },
];

const LEFT_AI_LINEUP = [LEFT_LINEUP[0], LEFT_LINEUP[2], LEFT_LINEUP[3]];

const AI_ROSTER: Array<{
  id: number;
  label: string;
  team: "left" | "right";
  lineupIndex: number;
  presetId: CarPresetId;
  roofNumber: string;
  aiArchetype: AIArchetype;
  color?: string;
  accent?: string;
}> = [
  {
    id: 1,
    label: "Rimshot",
    team: "left",
    lineupIndex: 0,
    presetId: "bulldozer",
    roofNumber: "14",
    aiArchetype: "bruiser",
    color: "#874316",
    accent: "#d8883c",
  },
  {
    id: 2,
    label: "Rustline",
    team: "left",
    lineupIndex: 1,
    presetId: "backstab",
    roofNumber: "27",
    aiArchetype: "scavenger",
    color: "#487128",
    accent: "#81b640",
  },
  {
    id: 3,
    label: "Sidewind",
    team: "left",
    lineupIndex: 2,
    presetId: "darter",
    roofNumber: "08",
    aiArchetype: "circler",
    color: "#6c3154",
    accent: "#ca71a5",
  },
  {
    id: 4,
    label: "Backlash",
    team: "right",
    lineupIndex: 0,
    presetId: "bulldozer",
    roofNumber: "77",
    aiArchetype: "bruiser",
    color: "#8a3523",
    accent: "#ef8d5f",
  },
  {
    id: 5,
    label: "Gravelord",
    team: "right",
    lineupIndex: 1,
    presetId: "darter",
    roofNumber: "11",
    aiArchetype: "circler",
    color: "#245d72",
    accent: "#78bbd7",
  },
  {
    id: 6,
    label: "Tarnish",
    team: "right",
    lineupIndex: 2,
    presetId: "backstab",
    roofNumber: "56",
    aiArchetype: "panic_driver",
    color: "#775319",
    accent: "#cfb55d",
  },
  {
    id: 7,
    label: "Mudlark",
    team: "right",
    lineupIndex: 3,
    presetId: "backstab",
    roofNumber: "93",
    aiArchetype: "scavenger",
    color: "#4f2b5d",
    accent: "#b48bcb",
  },
];

function createCameraState(): GameState["camera"] {
  return { shake: 0, nudgeX: 0, nudgeY: 0, freezeTime: 0 };
}

function clearRoundRuntimeState(state: GameState): void {
  state.winnerId = null;
  state.outlastedDriverIds = [];
  state.recentCollisions = [];
  state.smokePuffs = [];
  state.debrisParticles = [];
  state.dustPuffs = [];
  state.events = [];
  state.pendingSystemEvents = [];
  state.camera = createCameraState();
  state.tick = 0;
}

function getAiLineupSlot(entry: (typeof AI_ROSTER)[number]): {
  x: number;
  y: number;
} {
  return entry.team === "left"
    ? LEFT_AI_LINEUP[entry.lineupIndex]
    : RIGHT_LINEUP[entry.lineupIndex];
}

function buildCar(
  id: number,
  options: {
    label: string;
    isPlayer: boolean;
    team: "left" | "right";
    presetId: CarPresetId;
    roofNumber: string;
    aiArchetype: AIArchetype | null;
    x: number;
    y: number;
    angle: number;
    color?: string;
    accent?: string;
    buildBonuses?: PlayerBuild | null;
    condition?: CarCondition | null;
  },
): Car {
  const preset = CAR_PRESETS[options.presetId];
  const build = options.buildBonuses;
  const condition = options.condition
    ? cloneCondition(options.condition)
    : createFreshCondition();
  const engineForce =
    preset.engineForce +
    (build?.reverseForceBonus ? build.reverseForceBonus * 0.18 : 0);
  const reverseForce = preset.reverseForce + (build?.reverseForceBonus ?? 0);
  const forwardMaxSpeed =
    preset.forwardMaxSpeed + (build?.forwardSpeedBonus ?? 0);
  const steeringSharpness =
    preset.steeringSharpness + (build?.steeringBonus ?? 0);
  const frontArmor = preset.frontArmor + (build?.frontArmorBonus ?? 0);
  const cooling = build?.coolingBonus ?? 0;
  const systems = {
    ...condition.systems,
    radiator: Math.min(1, condition.systems.radiator + cooling),
  };
  const car: Car = {
    id,
    label: options.label,
    isPlayer: options.isPlayer,
    team: options.team,
    color: options.color ?? preset.color,
    accent: options.accent ?? preset.accent,
    roofNumber: options.roofNumber,
    presetId: options.presetId,
    aiArchetype: options.aiArchetype,
    x: options.x,
    y: options.y,
    angle: options.angle,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
    width: preset.width,
    length: preset.length,
    mass: preset.mass,
    controls: { steer: 0, forward: 0, reverse: 0 },
    driveInput: 0,
    steerAngle: 0,
    steerAngleTarget: 0,
    wheelbase: preset.wheelbase,
    engineForce,
    brakeForce: preset.brakeForce,
    reverseForce,
    forwardMaxSpeed,
    reverseMaxSpeed: preset.reverseMaxSpeed,
    steeringSharpness,
    bodyArmor: preset.bodyArmor,
    frontArmor,
    tractionBias: preset.tractionBias,
    engineTone: preset.engineTone,
    systems,
    phases: {
      engine: "healthy",
      radiator: "healthy",
      transmission: "healthy",
      steering: "healthy",
    },
    body: { ...condition.body },
    lights: { ...condition.lights },
    disabled: false,
    eliminationTime: null,
    slipAmount: 0,
    aiState: {
      targetId: null,
      jamTimer: 0,
      resetTimer: 0,
    },
    smokeTimer: 0,
    smokeBurstCount: 0,
  };
  car.phases = getCarSystemPhases(car);
  return car;
}

function createPreviewCars(state: GameState): Car[] {
  const build = createDefaultPlayerBuild("bulldozer");
  const player = buildCar(0, {
    label: "Player",
    isPlayer: true,
    team: "left",
    presetId: build.presetId,
    roofNumber: "01",
    aiArchetype: null,
    x: LEFT_LINEUP[1].x,
    y: LEFT_LINEUP[1].y,
    angle: Math.PI,
    buildBonuses: build,
    condition: createFreshCondition(),
  });
  const others = AI_ROSTER.map((entry) => {
    const slot = getAiLineupSlot(entry);
    return buildCar(entry.id, {
      label: entry.label,
      isPlayer: false,
      team: entry.team,
      presetId: entry.presetId,
      roofNumber: entry.roofNumber,
      aiArchetype: entry.aiArchetype,
      x: slot.x,
      y: slot.y,
      angle: entry.team === "left" ? Math.PI : 0,
      color: entry.color,
      accent: entry.accent,
    });
  });
  return [player, ...others];
}

function createPreviewSmokePuffs(
  state: GameState,
  car: Car,
  density: number,
  flame: number,
  count: number,
): GameState["smokePuffs"] {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const hoodDistance = car.length * 0.38;
  return Array.from({ length: count }, (_, index) => {
    const spread = index - (count - 1) * 0.5;
    return {
      id: state.nextSmokePuffId + index,
      sourceCarId: car.id,
      x: car.x + forwardX * hoodDistance + rightX * spread * 8,
      y: car.y + forwardY * hoodDistance + rightY * spread * 8 - index * 9,
      vx: 0,
      vy: 0,
      age: index * 0.08,
      ttl: 1.2,
      size: 11 + density * 8 + flame * 2 + index * 0.7,
      density,
      flame,
    };
  });
}

function applyBuildUpgrade(
  state: GameState,
  upgradeId: SessionUpgradeId,
): void {
  const build = state.session.playerBuild;
  if (!build) {
    return;
  }
  if (upgradeId === "pit_patch") {
    build.coolingBonus += 0.05;
    build.repairsUsed += 1;
  } else if (upgradeId === "ram_rig") {
    build.reverseForceBonus += 12000;
    build.forwardSpeedBonus += 8;
    build.frontArmorBonus += 0.08;
  } else if (upgradeId === "steering_clinic") {
    build.steeringBonus += 0.12;
    build.frontArmorBonus += 0.04;
  }
}

function repairSystem(
  condition: CarCondition,
  system: keyof Omit<CarCondition["systems"], "overheat">,
  amount: number,
): void {
  condition.systems[system] = Math.min(1, condition.systems[system] + amount);
}

function coolCondition(condition: CarCondition, amount: number): void {
  condition.systems.overheat = Math.max(0, condition.systems.overheat - amount);
}

function repairBody(
  condition: CarCondition,
  zone: keyof CarCondition["body"],
  amount: number,
): void {
  condition.body[zone] = Math.max(0, condition.body[zone] - amount);
}

function restoreAllLights(condition: CarCondition): void {
  condition.lights.frontLeft = true;
  condition.lights.frontRight = true;
  condition.lights.rearLeft = true;
  condition.lights.rearRight = true;
}

function serviceCondition(
  condition: CarCondition,
  upgradeId: SessionUpgradeId,
): CarCondition {
  const next = cloneCondition(condition);
  const baselineRepair = 0.08;
  repairSystem(next, "engine", baselineRepair);
  repairSystem(next, "radiator", baselineRepair);
  repairSystem(next, "transmission", baselineRepair);
  repairSystem(next, "steering", baselineRepair);
  coolCondition(next, 0.25);
  repairBody(next, "front", 0.06);
  repairBody(next, "rear", 0.06);
  repairBody(next, "left", 0.06);
  repairBody(next, "right", 0.06);

  switch (upgradeId) {
    case "pit_patch":
      repairSystem(next, "engine", 0.18);
      repairSystem(next, "radiator", 0.22);
      repairSystem(next, "transmission", 0.14);
      repairBody(next, "front", 0.14);
      repairBody(next, "left", 0.1);
      repairBody(next, "right", 0.1);
      restoreAllLights(next);
      break;
    case "ram_rig":
      repairSystem(next, "engine", 0.08);
      repairSystem(next, "transmission", 0.12);
      repairBody(next, "front", 0.08);
      break;
    case "steering_clinic":
      repairSystem(next, "steering", 0.24);
      repairSystem(next, "transmission", 0.08);
      repairBody(next, "left", 0.1);
      repairBody(next, "right", 0.1);
      break;
  }

  return next;
}

function buildArenaFromPlan(roundPlan: RoundPlan): GameState["arena"] {
  return {
    width: 1500,
    height: 900,
    wallPadding: 54,
    variant: roundPlan.arenaVariant,
    modifier: roundPlan.modifier,
    title: roundPlan.title,
    introLine: roundPlan.introLine,
    mudZones: getArenaMudZones(roundPlan.arenaVariant),
    objects: getArenaObjects(roundPlan.arenaVariant),
  };
}

function prepareRound(state: GameState, roundIndex: number): void {
  const roundPlan = ROUND_PLANS[roundIndex];
  state.session.roundIndex = roundIndex;
  state.session.roundPlan = roundPlan;
  state.arena = buildArenaFromPlan(roundPlan);
  const build =
    state.session.playerBuild ?? createDefaultPlayerBuild("bulldozer");
  const condition = state.session.playerCondition ?? createFreshCondition();
  const player = buildCar(0, {
    label: "Player",
    isPlayer: true,
    team: "left",
    presetId: build.presetId,
    roofNumber: "01",
    aiArchetype: null,
    x: LEFT_LINEUP[1].x,
    y: LEFT_LINEUP[1].y,
    angle: Math.PI,
    buildBonuses: build,
    condition,
  });

  const others = AI_ROSTER.map((entry) => {
    const slot = getAiLineupSlot(entry);
    return buildCar(entry.id, {
      label: entry.label,
      isPlayer: false,
      team: entry.team,
      presetId: entry.presetId,
      roofNumber: entry.roofNumber,
      aiArchetype: entry.aiArchetype,
      x: slot.x,
      y: slot.y,
      angle: entry.team === "left" ? Math.PI : 0,
      color: entry.color,
      accent: entry.accent,
    });
  });

  state.cars = [player, ...others];
  state.playerId = 0;
  clearRoundRuntimeState(state);
  state.session.countdown = 3.2;
  state.session.lastRoundSummary = null;
  state.mode = "intro";

  if (roundPlan.modifier === "hot_engines") {
    for (const car of state.cars) {
      car.systems.overheat = 0.4;
    }
  }
  if (roundPlan.modifier === "lights_out") {
    for (const car of state.cars) {
      car.lights.rearLeft = false;
      if (!car.isPlayer) {
        car.lights.rearRight = false;
      }
      car.body.rear = Math.min(1, car.body.rear + 0.04);
    }
  }

  resetRoundStats(state);
  pushEvent(
    state,
    `Round ${roundPlan.id}: ${roundPlan.title}`,
    "countdown",
    0.9,
    2.8,
  );
}

export function createInitialState(): GameState {
  const previewPlan = ROUND_PLANS[0];
  const state: GameState = {
    mode: "menu",
    arena: buildArenaFromPlan(previewPlan),
    preview: null,
    session: {
      totalRounds: TOTAL_ROUNDS,
      roundIndex: 0,
      roundPlan: previewPlan,
      playerBuild: null,
      playerCondition: null,
      completedRounds: [],
      lastRoundSummary: null,
      countdown: 0,
    },
    cars: [],
    playerId: 0,
    tick: 0,
    elapsed: 0,
    winnerId: null,
    outlastedDriverIds: [],
    recentCollisions: [],
    smokePuffs: [],
    nextSmokePuffId: 1,
    debrisParticles: [],
    nextDebrisParticleId: 1,
    dustPuffs: [],
    nextDustPuffId: 1,
    events: [],
    nextEventId: 1,
    camera: createCameraState(),
    pendingSystemEvents: [],
    roundStats: createRoundStats(),
  };
  state.cars = createPreviewCars(state);
  return state;
}

export function createCarPreviewState(
  presetId: CarPresetId,
  scenarioId: CarPreviewScenarioId,
): GameState {
  const state = createInitialState();
  const scenario = CAR_PREVIEW_SCENARIOS[scenarioId];
  const car = buildCar(0, {
    label: CAR_PRESETS[presetId].title,
    isPlayer: true,
    team: "left",
    presetId,
    roofNumber: "01",
    aiArchetype: null,
    x: 450,
    y: 360,
    angle: 0,
    buildBonuses: createDefaultPlayerBuild(presetId),
    condition: scenario.condition,
  });
  car.disabled = Boolean(scenario.disabled);
  car.phases = getCarSystemPhases(car);

  state.mode = "car_preview";
  state.preview = {
    kind: "car",
    presetId,
    scenario: scenarioId,
  };
  state.arena = {
    width: 900,
    height: 720,
    wallPadding: 0,
    variant: "classic",
    modifier: "none",
    title: "Car Preview",
    introLine: scenario.title,
    mudZones: [],
    objects: [],
  };
  state.session.roundPlan = null;
  state.session.playerBuild = createDefaultPlayerBuild(presetId);
  state.session.playerCondition = cloneCondition(scenario.condition);
  state.session.countdown = 0;
  state.cars = [car];
  state.playerId = car.id;
  state.winnerId = null;
  state.outlastedDriverIds = [];
  state.recentCollisions = [];
  state.events = [];
  state.camera = createCameraState();
  state.debrisParticles = [];
  state.dustPuffs = [];
  state.nextSmokePuffId = 1;
  state.smokePuffs = scenario.smoke
    ? createPreviewSmokePuffs(
        state,
        car,
        scenario.smoke.density,
        scenario.smoke.flame,
        scenario.smoke.count,
      )
    : [];
  state.nextSmokePuffId = state.smokePuffs.length + 1;
  return state;
}

export function restartState(state: GameState): GameState {
  Object.assign(state, createInitialState());
  return state;
}

export function beginCarSelect(state: GameState): void {
  state.mode = "car_select";
  state.session.lastRoundSummary = null;
}

export function chooseStarterCar(
  state: GameState,
  presetId: CarPresetId,
): void {
  state.session.playerBuild = createDefaultPlayerBuild(presetId);
  state.session.playerCondition = createFreshCondition();
  state.session.completedRounds = [];
  state.session.lastRoundSummary = null;
  prepareRound(state, 0);
}

export function advanceAfterRound(state: GameState): void {
  const summary = state.session.lastRoundSummary;
  if (!summary) {
    return;
  }
  if (
    !summary.playerWon ||
    state.session.roundIndex >= state.session.totalRounds - 1
  ) {
    state.mode = "tournament_over";
    return;
  }
  state.mode = "upgrade";
}

export function applySessionUpgrade(
  state: GameState,
  upgradeId: SessionUpgradeId,
): void {
  if (!state.session.playerCondition) {
    return;
  }
  applyBuildUpgrade(state, upgradeId);
  state.session.playerCondition = serviceCondition(
    state.session.playerCondition,
    upgradeId,
  );
  prepareRound(state, state.session.roundIndex + 1);
}
