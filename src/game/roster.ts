import {
  DEFAULT_ARENA_GEOMETRY,
  materializeArenaPoint,
} from "./arena";
import {
  CAR_PRESETS,
  createDefaultPlayerBuild,
} from "./content";
import { cloneCondition, createFreshCondition } from "./conditions";
import {
  cloneCarFrame,
  createFreshFrame,
  seedFrameFromBodyDamage,
} from "./deformation";
import type {
  AIArchetype,
  ArenaGeometry,
  Car,
  CarCondition,
  CarPresetId,
  PlayerBuild,
} from "./types";

const LEFT_LINEUP = [
  { xRatio: 0.11925287356321838, yRatio: 0.14646464646464646 },
  { xRatio: 0.11925287356321838, yRatio: 0.380050505050505 },
  { xRatio: 0.11925287356321838, yRatio: 0.6136363636363636 },
  { xRatio: 0.11925287356321838, yRatio: 0.8472222222222222 },
];

const RIGHT_LINEUP = [
  { xRatio: 0.8807471264367817, yRatio: 0.14646464646464646 },
  { xRatio: 0.8807471264367817, yRatio: 0.380050505050505 },
  { xRatio: 0.8807471264367817, yRatio: 0.6136363636363636 },
  { xRatio: 0.8807471264367817, yRatio: 0.8472222222222222 },
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

function materializeLineupPoint(
  geometry: ArenaGeometry,
  slot: { xRatio: number; yRatio: number },
  presetId: CarPresetId,
  angle: number,
): { x: number; y: number } {
  const point = materializeArenaPoint(
    geometry,
    slot.xRatio,
    slot.yRatio,
  );
  const preset = CAR_PRESETS[presetId];
  const halfLength = preset.length * 0.5;
  const halfWidth = preset.width * 0.5;
  const absoluteCosine = Math.abs(Math.cos(angle));
  const absoluteSine = Math.abs(Math.sin(angle));
  const xExtent =
    absoluteCosine * halfLength + absoluteSine * halfWidth;
  const yExtent =
    absoluteSine * halfLength + absoluteCosine * halfWidth;
  const xMin = geometry.wallPadding + xExtent;
  const xMax = geometry.width - geometry.wallPadding - xExtent;
  const yMin = geometry.wallPadding + yExtent;
  const yMax = geometry.height - geometry.wallPadding - yExtent;
  if (xMin > xMax || yMin > yMax) {
    throw new RangeError("Arena geometry is too small for the car lineup.");
  }
  return {
    x: Math.min(xMax, Math.max(xMin, point.x)),
    y: Math.min(yMax, Math.max(yMin, point.y)),
  };
}

function getAiLineupSlot(
  entry: (typeof AI_ROSTER)[number],
  geometry: ArenaGeometry,
): {
  x: number;
  y: number;
} {
  const slot = entry.team === "left"
    ? LEFT_AI_LINEUP[entry.lineupIndex]
    : RIGHT_LINEUP[entry.lineupIndex];
  return materializeLineupPoint(
    geometry,
    slot,
    entry.presetId,
    entry.team === "left" ? Math.PI : 0,
  );
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
  const frame = condition.frame
    ? cloneCarFrame(condition.frame)
    : createFreshFrame(preset.length, preset.width);
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
    body: { ...condition.body },
    frame,
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
  if (!condition.frame) {
    seedFrameFromBodyDamage(car);
  }
  return car;
}

function createAiCars(geometry: ArenaGeometry): Car[] {
  return AI_ROSTER.map((entry) => {
    const slot = getAiLineupSlot(entry, geometry);
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

export function createMenuPreviewCars(
  geometry: ArenaGeometry = DEFAULT_ARENA_GEOMETRY,
): Car[] {
  const build = createDefaultPlayerBuild("bulldozer");
  const playerSlot = materializeLineupPoint(
    geometry,
    LEFT_LINEUP[1],
    build.presetId,
    Math.PI,
  );
  const player = buildCar(0, {
    label: "Player",
    isPlayer: true,
    team: "left",
    presetId: build.presetId,
    roofNumber: "01",
    aiArchetype: null,
    x: playerSlot.x,
    y: playerSlot.y,
    angle: Math.PI,
    buildBonuses: build,
    condition: createFreshCondition(),
  });
  return [player, ...createAiCars(geometry)];
}

export function createRoundCars(
  build: PlayerBuild,
  condition: CarCondition,
  geometry: ArenaGeometry = DEFAULT_ARENA_GEOMETRY,
): Car[] {
  const playerSlot = materializeLineupPoint(
    geometry,
    LEFT_LINEUP[1],
    build.presetId,
    Math.PI,
  );
  const player = buildCar(0, {
    label: "Player",
    isPlayer: true,
    team: "left",
    presetId: build.presetId,
    roofNumber: "01",
    aiArchetype: null,
    x: playerSlot.x,
    y: playerSlot.y,
    angle: Math.PI,
    buildBonuses: build,
    condition,
  });
  return [player, ...createAiCars(geometry)];
}

export function createCarPreviewCar(
  presetId: CarPresetId,
  condition: CarCondition,
  disabled = false,
  geometry: ArenaGeometry = {
    width: 900,
    height: 720,
    wallPadding: 0,
  },
): Car {
  const car = buildCar(0, {
    label: CAR_PRESETS[presetId].title,
    isPlayer: true,
    team: "left",
    presetId,
    roofNumber: "01",
    aiArchetype: null,
    x: geometry.width / 2,
    y: geometry.height / 2,
    angle: 0,
    buildBonuses: createDefaultPlayerBuild(presetId),
    condition,
  });
  car.disabled = disabled;
  return car;
}
