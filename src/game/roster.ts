import {
  CAR_PRESETS,
  createDefaultPlayerBuild,
} from "./content";
import { cloneCondition, createFreshCondition } from "./conditions";
import { getCarSystemPhases } from "./damage";
import type {
  AIArchetype,
  Car,
  CarCondition,
  CarPresetId,
  PlayerBuild,
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

function createAiCars(): Car[] {
  return AI_ROSTER.map((entry) => {
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
}

export function createMenuPreviewCars(): Car[] {
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
  return [player, ...createAiCars()];
}

export function createRoundCars(
  build: PlayerBuild,
  condition: CarCondition,
): Car[] {
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
  return [player, ...createAiCars()];
}

export function createCarPreviewCar(
  presetId: CarPresetId,
  condition: CarCondition,
  disabled = false,
): Car {
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
    condition,
  });
  car.disabled = disabled;
  car.phases = getCarSystemPhases(car);
  return car;
}
