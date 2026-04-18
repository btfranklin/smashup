import { updateAi } from "./ai";
import {
  AI_ARCHETYPE_LABELS,
  CAR_PREVIEW_SCENARIOS,
  CAR_PRESETS,
  ROUND_PLANS,
  SESSION_UPGRADES,
  TOTAL_ROUNDS,
  createDefaultPlayerBuild,
  getArenaMudZones,
  getArenaObjects,
  getModifierSummary,
} from "./content";
import { getCarSystemPhases, getEngineHealth, getKnockoutCause } from "./damage";
import { getRecentDebrisSummary, spawnImpactDebris, updateDebrisEffects } from "./debris";
import { spawnCollisionDust, spawnSlipDust, updateDustEffects } from "./dust";
import { signedSpeedForCar } from "./math";
import { resolveArenaObjectInteractions, resolveCarCollisions, stepArenaObjects, stepCar } from "./physics";
import { getActiveCars, getCarById, getOutlastedDriverLabels, getPlayerCar, getWinnerCar } from "./selectors";
import { updateSmokeEffects } from "./smoke";
import type {
  AIArchetype,
  ArenaVariantId,
  Car,
  CarCondition,
  CarPreviewScenarioId,
  CarPresetId,
  DamagePhase,
  EventMessage,
  GameState,
  RoundPlan,
  RoundSummary,
  SessionUpgradeId,
  SystemName,
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
  presetId: CarPresetId;
  roofNumber: string;
  aiArchetype: AIArchetype;
  color?: string;
  accent?: string;
}> = [
  { id: 1, label: "Rimshot", team: "left", presetId: "bulldozer", roofNumber: "14", aiArchetype: "bruiser", color: "#874316", accent: "#d8883c" },
  { id: 2, label: "Rustline", team: "left", presetId: "backstab", roofNumber: "27", aiArchetype: "scavenger", color: "#487128", accent: "#81b640" },
  { id: 3, label: "Sidewind", team: "left", presetId: "darter", roofNumber: "08", aiArchetype: "circler", color: "#6c3154", accent: "#ca71a5" },
  { id: 4, label: "Backlash", team: "right", presetId: "bulldozer", roofNumber: "77", aiArchetype: "bruiser", color: "#8a3523", accent: "#ef8d5f" },
  { id: 5, label: "Gravelord", team: "right", presetId: "darter", roofNumber: "11", aiArchetype: "circler", color: "#245d72", accent: "#78bbd7" },
  { id: 6, label: "Tarnish", team: "right", presetId: "backstab", roofNumber: "56", aiArchetype: "panic_driver", color: "#775319", accent: "#cfb55d" },
  { id: 7, label: "Mudlark", team: "right", presetId: "backstab", roofNumber: "93", aiArchetype: "scavenger", color: "#4f2b5d", accent: "#b48bcb" },
];

function createFreshCondition(): CarCondition {
  return {
    systems: {
      engine: 1,
      radiator: 1,
      transmission: 1,
      steering: 1,
      overheat: 0,
    },
    body: {
      front: 0,
      rear: 0,
      left: 0,
      right: 0,
    },
    lights: {
      frontLeft: true,
      frontRight: true,
      rearLeft: true,
      rearRight: true,
    },
  };
}

function cloneCondition(condition: CarCondition): CarCondition {
  return {
    systems: { ...condition.systems },
    body: { ...condition.body },
    lights: { ...condition.lights },
  };
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
    buildBonuses?: GameState["session"]["playerBuild"];
    condition?: CarCondition | null;
  },
): Car {
  const preset = CAR_PRESETS[options.presetId];
  const build = options.buildBonuses;
  const condition = options.condition ? cloneCondition(options.condition) : createFreshCondition();
  const engineForce = preset.engineForce + (build?.reverseForceBonus ? build.reverseForceBonus * 0.18 : 0);
  const reverseForce = preset.reverseForce + (build?.reverseForceBonus ?? 0);
  const forwardMaxSpeed = preset.forwardMaxSpeed + (build?.forwardSpeedBonus ?? 0);
  const steeringSharpness = preset.steeringSharpness + (build?.steeringBonus ?? 0);
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
  const others = AI_ROSTER.map((entry, index) =>
    buildCar(entry.id, {
      label: entry.label,
      isPlayer: false,
      team: entry.team,
      presetId: entry.presetId,
      roofNumber: entry.roofNumber,
      aiArchetype: entry.aiArchetype,
      x:
        entry.team === "left"
          ? LEFT_AI_LINEUP[index].x
          : RIGHT_LINEUP[index - LEFT_AI_LINEUP.length].x,
      y:
        entry.team === "left"
          ? LEFT_AI_LINEUP[index].y
          : RIGHT_LINEUP[index - LEFT_AI_LINEUP.length].y,
      angle: entry.team === "left" ? Math.PI : 0,
      color: entry.color,
      accent: entry.accent,
    }),
  );
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

function pushEvent(
  state: GameState,
  text: string,
  kind: EventMessage["kind"],
  emphasis = 0.6,
  ttl = 2.2,
): void {
  state.events.push({
    id: state.nextEventId++,
    text,
    kind,
    ttl,
    emphasis,
  });
  state.events = state.events.slice(-8);
}

function resetRoundStats(state: GameState): void {
  state.roundStats = {
    startElapsed: state.elapsed,
    biggestHitSeverity: 0,
    biggestHitLabel: null,
    eliminatedById: null,
    knockoutReason: null,
    playerKnockouts: [],
    lastPlayerTargetId: null,
    finalTwoAnnounced: false,
  };
}

function getKnockoutReason(car: Car): string {
  const cause = getKnockoutCause(car);
  switch (cause) {
    case "engine_fire":
      return "Engine Heat";
    case "engine_failure":
      return "Engine Failure";
    case "radiator_failure":
      return "Radiator Gone";
    case "catastrophic_front_hit":
      return "Front End Wrecked";
    case "body_collapse":
      return "Body Folded";
    default: {
      const ordered: Array<[SystemName, number]> = [
        ["engine", car.systems.engine],
        ["radiator", car.systems.radiator],
        ["transmission", car.systems.transmission],
        ["steering", car.systems.steering],
      ].sort((a, b) => a[1] - b[1]);
      const weakest = ordered[0][0];
      return weakest === "steering" ? "Steering Folded" : "Engine Failure";
    }
  }
}

function capturePlayerCondition(player: Car): CarCondition {
  return {
    systems: { ...player.systems },
    body: { ...player.body },
    lights: { ...player.lights },
  };
}

function serviceCondition(condition: CarCondition, upgradeId: SessionUpgradeId): CarCondition {
  const next = cloneCondition(condition);
  const baselineRepair = 0.08;
  next.systems.engine = Math.min(1, next.systems.engine + baselineRepair);
  next.systems.radiator = Math.min(1, next.systems.radiator + baselineRepair);
  next.systems.transmission = Math.min(1, next.systems.transmission + baselineRepair);
  next.systems.steering = Math.min(1, next.systems.steering + baselineRepair);
  next.systems.overheat = Math.max(0, next.systems.overheat - 0.25);
  next.body.front = Math.max(0, next.body.front - 0.06);
  next.body.rear = Math.max(0, next.body.rear - 0.06);
  next.body.left = Math.max(0, next.body.left - 0.06);
  next.body.right = Math.max(0, next.body.right - 0.06);

  switch (upgradeId) {
    case "pit_patch":
      next.systems.engine = Math.min(1, next.systems.engine + 0.18);
      next.systems.radiator = Math.min(1, next.systems.radiator + 0.22);
      next.systems.transmission = Math.min(1, next.systems.transmission + 0.14);
      next.body.front = Math.max(0, next.body.front - 0.14);
      next.body.left = Math.max(0, next.body.left - 0.1);
      next.body.right = Math.max(0, next.body.right - 0.1);
      next.lights.frontLeft = true;
      next.lights.frontRight = true;
      next.lights.rearLeft = true;
      next.lights.rearRight = true;
      break;
    case "ram_rig":
      next.systems.engine = Math.min(1, next.systems.engine + 0.08);
      next.systems.transmission = Math.min(1, next.systems.transmission + 0.12);
      next.body.front = Math.max(0, next.body.front - 0.08);
      break;
    case "steering_clinic":
      next.systems.steering = Math.min(1, next.systems.steering + 0.24);
      next.systems.transmission = Math.min(1, next.systems.transmission + 0.08);
      next.body.left = Math.max(0, next.body.left - 0.1);
      next.body.right = Math.max(0, next.body.right - 0.1);
      break;
  }

  return next;
}

function applyBuildUpgrade(state: GameState, upgradeId: SessionUpgradeId): void {
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
  const build = state.session.playerBuild ?? createDefaultPlayerBuild("bulldozer");
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
    const slot = entry.team === "left" ? LEFT_AI_LINEUP[entry.id - 1] : RIGHT_LINEUP[entry.id - 4];
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
  state.winnerId = null;
  state.outlastedDriverIds = [];
  state.recentCollisions = [];
  state.smokePuffs = [];
  state.debrisParticles = [];
  state.dustPuffs = [];
  state.events = [];
  state.pendingSystemEvents = [];
  state.camera = { shake: 0, nudgeX: 0, nudgeY: 0, freezeTime: 0 };
  state.session.countdown = 3.2;
  state.mode = "intro";
  state.tick = 0;
  state.smokePuffs = [];
  state.arena.objects = getArenaObjects(roundPlan.arenaVariant);

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

function makeRoundSummary(state: GameState, playerWon: boolean): RoundSummary {
  const player = getPlayerCar(state);
  const winner = getWinnerCar(state);
  const eliminatedBy = getCarById(state, state.roundStats.eliminatedById);
  const roundPlan = state.session.roundPlan;
  return {
    roundIndex: state.session.roundIndex + 1,
    title: roundPlan?.title ?? `Round ${state.session.roundIndex + 1}`,
    playerWon,
    winnerLabel: winner?.label ?? (playerWon ? "Player" : null),
    survivalTime: Number((state.elapsed - state.roundStats.startElapsed).toFixed(1)),
    eliminatedByLabel: eliminatedBy?.label ?? null,
    playerKnockouts: [...state.roundStats.playerKnockouts],
    biggestHitLabel: state.roundStats.biggestHitLabel,
    biggestHitSeverity: Number(state.roundStats.biggestHitSeverity.toFixed(2)),
    knockoutReason: !playerWon && player ? getKnockoutReason(player) : null,
  };
}

function refreshPhaseEvents(state: GameState, car: Car): void {
  const nextPhases = getCarSystemPhases(car);
  for (const system of ["engine", "radiator", "transmission", "steering"] as const) {
    if (car.phases[system] !== nextPhases[system]) {
      if (car.isPlayer && nextPhases[system] !== "healthy") {
        state.pendingSystemEvents.push({ carId: car.id, system, phase: nextPhases[system] });
      }
      car.phases[system] = nextPhases[system];
    }
  }
}

function flushPendingSystemEvents(state: GameState): void {
  for (const entry of state.pendingSystemEvents.splice(0)) {
    const name =
      entry.system === "engine"
        ? "Engine Hurt"
        : entry.system === "radiator"
          ? "Radiator Hit"
          : entry.system === "transmission"
            ? "Transmission Slipping"
            : "Steering Bent";
    const emphasis =
      entry.phase === "critical" ? 1 : entry.phase === "failing" ? 0.8 : 0.62;
    pushEvent(state, name, "system", emphasis, 2.2);
  }
}

function registerCollisionDrama(state: GameState): void {
  if (state.recentCollisions.length === 0) {
    return;
  }
  const strongest = [...state.recentCollisions].sort((a, b) => b.severity - a.severity)[0];
  if (strongest.severity > state.roundStats.biggestHitSeverity) {
    const a = getCarById(state, strongest.aId);
    const b = getCarById(state, strongest.bId);
    state.roundStats.biggestHitSeverity = strongest.severity;
    state.roundStats.biggestHitLabel = a && b ? `${a.label} into ${b.label}` : null;
  }

  const playerInvolved = strongest.aId === state.playerId || strongest.bId === state.playerId;
  const qualifiesForShake =
    (playerInvolved && strongest.severity >= 0.84) ||
    (!playerInvolved && strongest.severity >= 0.93);
  if (qualifiesForShake) {
    const scale = playerInvolved ? 1 : 0.85;
    state.camera.shake = Math.max(state.camera.shake, strongest.severity * 4.8 * scale);
    state.camera.nudgeX += strongest.normal.x * strongest.severity * 2.8 * scale;
    state.camera.nudgeY += strongest.normal.y * strongest.severity * 2.8 * scale;
  }
  if (playerInvolved && strongest.severity >= 0.94) {
    state.camera.freezeTime = Math.max(state.camera.freezeTime, 0.02);
  }
  const strongestA = getCarById(state, strongest.aId);
  const strongestB = getCarById(state, strongest.bId);
  const hasDisabledParticipant = Boolean(strongestA?.disabled || strongestB?.disabled);
  if (strongest.severity > 0.82 && !hasDisabledParticipant) {
    pushEvent(state, "Huge Hit!", "impact", strongest.severity, 1.2);
  }
}

function registerNewEliminations(
  state: GameState,
  beforeDisabled: Map<number, boolean>,
): void {
  for (const car of state.cars) {
    if (beforeDisabled.get(car.id) || !car.disabled) {
      continue;
    }

    const relevant = [...state.recentCollisions]
      .filter((collision) => collision.aId === car.id || collision.bId === car.id)
      .sort((a, b) => b.damageSeverity - a.damageSeverity)[0];
    const attackerId =
      relevant
        ? relevant.aId === car.id
          ? relevant.bId
          : relevant.aId
        : null;
    const attacker = getCarById(state, attackerId);

    if (car.id === state.playerId) {
      state.roundStats.eliminatedById = attackerId;
      state.roundStats.knockoutReason = getKnockoutReason(car);
      pushEvent(
        state,
        attacker ? `${attacker.label} finished you` : state.roundStats.knockoutReason,
        "result",
        1,
        2.6,
      );
    } else if (attackerId === state.playerId) {
      state.roundStats.playerKnockouts.push(car.label);
      pushEvent(state, `You wrecked ${car.label}`, "result", 0.9, 2.2);
    } else {
      pushEvent(state, `${car.label} is done`, "warning", 0.66, 1.6);
    }
  }
}

function updateEventFeed(state: GameState, dt: number): void {
  for (const event of state.events) {
    event.ttl -= dt;
  }
  state.events = state.events.filter((event) => event.ttl > 0);
}

function updateCamera(state: GameState, dt: number): void {
  state.camera.shake = Math.max(0, state.camera.shake - dt * 34);
  state.camera.nudgeX *= Math.pow(0.58, dt * 60);
  state.camera.nudgeY *= Math.pow(0.58, dt * 60);
  if (state.camera.shake < 0.08) {
    state.camera.shake = 0;
  }
  if (Math.abs(state.camera.nudgeX) < 0.08) {
    state.camera.nudgeX = 0;
  }
  if (Math.abs(state.camera.nudgeY) < 0.08) {
    state.camera.nudgeY = 0;
  }
  state.camera.freezeTime = Math.max(0, state.camera.freezeTime - dt);
}

function maybeAnnounceFinalTwo(state: GameState): void {
  if (state.roundStats.finalTwoAnnounced) {
    return;
  }
  if (getActiveCars(state).length === 2) {
    state.roundStats.finalTwoAnnounced = true;
    pushEvent(state, "Down to the final two!", "warning", 0.92, 2);
  }
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
      pendingUpgradeChoices: Object.keys(SESSION_UPGRADES) as SessionUpgradeId[],
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
    camera: { shake: 0, nudgeX: 0, nudgeY: 0, freezeTime: 0 },
    pendingSystemEvents: [],
    roundStats: {
      startElapsed: 0,
      biggestHitSeverity: 0,
      biggestHitLabel: null,
      eliminatedById: null,
      knockoutReason: null,
      playerKnockouts: [],
      lastPlayerTargetId: null,
      finalTwoAnnounced: false,
    },
  };
  state.cars = createPreviewCars(state);
  return state;
}

export function createCarPreviewState(
  presetId: CarPresetId,
  scenarioId: CarPreviewScenarioId,
): GameState {
  const state = createInitialState();
  const scenario = CAR_PREVIEW_SCENARIOS[scenarioId] ?? CAR_PREVIEW_SCENARIOS.pristine;
  const car = buildCar(0, {
    label: CAR_PRESETS[presetId]?.title ?? "Preview",
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
  state.camera = { shake: 0, nudgeX: 0, nudgeY: 0, freezeTime: 0 };
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
  const fresh = createInitialState();
  state.mode = fresh.mode;
  state.arena = fresh.arena;
  state.preview = null;
  state.session = fresh.session;
  state.cars = fresh.cars;
  state.playerId = fresh.playerId;
  state.tick = 0;
  state.elapsed = 0;
  state.winnerId = null;
  state.outlastedDriverIds = [];
  state.recentCollisions = [];
  state.smokePuffs = [];
  state.nextSmokePuffId = 1;
  state.debrisParticles = [];
  state.nextDebrisParticleId = 1;
  state.dustPuffs = [];
  state.nextDustPuffId = 1;
  state.events = [];
  state.nextEventId = 1;
  state.camera = { shake: 0, nudgeX: 0, nudgeY: 0, freezeTime: 0 };
  state.pendingSystemEvents = [];
  resetRoundStats(state);
  return state;
}

export function beginCarSelect(state: GameState): void {
  state.mode = "car_select";
  state.session.lastRoundSummary = null;
}

export function chooseStarterCar(state: GameState, presetId: CarPresetId): void {
  state.session.playerBuild = createDefaultPlayerBuild(presetId);
  state.session.playerCondition = createFreshCondition();
  state.session.completedRounds = [];
  state.session.lastRoundSummary = null;
  state.session.pendingUpgradeChoices = Object.keys(SESSION_UPGRADES) as SessionUpgradeId[];
  prepareRound(state, 0);
}

export function advanceAfterRound(state: GameState): void {
  const summary = state.session.lastRoundSummary;
  if (!summary) {
    return;
  }
  if (!summary.playerWon || state.session.roundIndex >= state.session.totalRounds - 1) {
    state.mode = "tournament_over";
    return;
  }
  state.mode = "upgrade";
}

export function applySessionUpgrade(state: GameState, upgradeId: SessionUpgradeId): void {
  if (!state.session.playerCondition) {
    return;
  }
  applyBuildUpgrade(state, upgradeId);
  state.session.playerCondition = serviceCondition(state.session.playerCondition, upgradeId);
  state.session.pendingUpgradeChoices = Object.keys(SESSION_UPGRADES) as SessionUpgradeId[];
  prepareRound(state, state.session.roundIndex + 1);
}

export function applyPlayerControls(
  state: GameState,
  input: {
    left: boolean;
    right: boolean;
    forward: boolean;
    reverse: boolean;
  },
): void {
  const player = getPlayerCar(state);
  if (!player || player.disabled || state.mode !== "running") {
    return;
  }

  player.controls.steer = Number(input.right) - Number(input.left);
  player.controls.forward = input.forward ? 1 : 0;
  player.controls.reverse = input.reverse ? 1 : 0;
}

export function advanceState(state: GameState, dt: number): void {
  if (state.mode === "car_preview") {
    return;
  }

  updateDebrisEffects(state, dt);
  updateSmokeEffects(state, dt);
  updateDustEffects(state, dt);
  updateEventFeed(state, dt);
  updateCamera(state, dt);

  if (state.mode === "intro") {
    state.session.countdown = Math.max(0, state.session.countdown - dt);
    if (state.session.countdown > 0.05 && state.session.countdown < 1.05) {
      pushEvent(state, "Go!", "countdown", 1, 0.5);
    }
    if (state.session.countdown <= 0) {
      state.mode = "running";
      state.events = [];
    }
    state.elapsed += dt;
    return;
  }

  if (state.mode !== "running") {
    state.recentCollisions = [];
    state.elapsed += dt;
    return;
  }

  const player = getPlayerCar(state);
  if (player?.disabled) {
    player.controls.forward = 0;
    player.controls.reverse = 0;
    player.controls.steer = 0;
  }

  if (state.camera.freezeTime > 0) {
    state.elapsed += dt;
    return;
  }

  for (const car of state.cars) {
    if (!car.isPlayer) {
      updateAi(
        car,
        state.cars,
        state.arena.width,
        state.arena.height,
        state.arena.wallPadding,
        dt,
      );
    }
  }

  const beforeDisabled = new Map(state.cars.map((car) => [car.id, car.disabled]));
  for (const car of state.cars) {
    stepCar(car, dt, state.arena, state.arena.mudZones);
    refreshPhaseEvents(state, car);
    if (car.disabled && car.eliminationTime === null) {
      car.eliminationTime = state.elapsed;
    }
  }

  stepArenaObjects(state.arena.objects, dt, state.arena);
  resolveArenaObjectInteractions(state.cars, state.arena.objects, state.arena);
  state.recentCollisions = resolveCarCollisions(state.cars);
  registerCollisionDrama(state);
  spawnImpactDebris(state);
  spawnCollisionDust(state);
  spawnSlipDust(state);

  for (const car of state.cars) {
    refreshPhaseEvents(state, car);
    if (car.disabled && car.eliminationTime === null) {
      car.eliminationTime = state.elapsed;
    }
  }

  registerNewEliminations(state, beforeDisabled);
  flushPendingSystemEvents(state);
  maybeAnnounceFinalTwo(state);

  const playerCar = getPlayerCar(state);
  const alive = getActiveCars(state);
  if (playerCar?.disabled) {
    state.winnerId = alive.length === 1 ? alive[0]?.id ?? null : null;
    state.outlastedDriverIds = alive
      .filter((car) => car.id !== state.playerId)
      .map((car) => car.id);
    state.session.playerCondition = capturePlayerCondition(playerCar);
    state.session.lastRoundSummary = makeRoundSummary(state, false);
    state.session.completedRounds.push(state.session.lastRoundSummary);
    state.mode = "round_results";
  } else if (alive.length <= 1) {
    state.winnerId = alive[0]?.id ?? null;
    state.outlastedDriverIds = [];
    if (playerCar) {
      state.session.playerCondition = capturePlayerCondition(playerCar);
    }
    state.session.lastRoundSummary = makeRoundSummary(state, true);
    state.session.completedRounds.push(state.session.lastRoundSummary);
    state.mode = "round_results";
    pushEvent(state, "Round Won!", "result", 1, 2.4);
  }

  state.tick += 1;
  state.elapsed += dt;
}

export function renderGameToText(state: GameState): string {
  if (state.mode === "car_preview") {
    const previewCar = getPlayerCar(state) ?? state.cars[0] ?? null;
    return JSON.stringify({
      mode: "car_preview",
      preview: state.preview,
      arena: {
        width: state.arena.width,
        height: state.arena.height,
        coordinates: {
          origin: "top-left",
          xAxis: "right",
          yAxis: "down",
        },
      },
      car: previewCar
        ? {
            label: previewCar.label,
            presetId: previewCar.presetId,
            roofNumber: previewCar.roofNumber,
            systems: previewCar.systems,
            phases: previewCar.phases,
            body: previewCar.body,
            lights: previewCar.lights,
            disabled: previewCar.disabled,
          }
        : null,
      effects: {
        smokePuffs: state.smokePuffs.length,
        smokePreview: state.smokePuffs.map((puff) => ({
          x: Number(puff.x.toFixed(1)),
          y: Number(puff.y.toFixed(1)),
          size: Number(puff.size.toFixed(1)),
          density: Number(puff.density.toFixed(2)),
          flame: Number(puff.flame.toFixed(2)),
        })),
      },
    });
  }

  const player = getPlayerCar(state);
  const otherCars = [...state.cars]
    .filter((car) => !car.isPlayer)
    .sort((a, b) => a.id - b.id);
  const payload = {
    mode: state.mode,
    arena: {
      width: state.arena.width,
      height: state.arena.height,
      wallPadding: state.arena.wallPadding,
      variant: state.arena.variant,
      modifier: state.arena.modifier,
      title: state.arena.title,
      coordinates: {
        origin: "top-left",
        xAxis: "right",
        yAxis: "down",
      },
      mudZones: state.arena.mudZones.map((zone) => ({
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
        grip: zone.grip,
      })),
      objects: state.arena.objects.slice(0, 8).map((object) => ({
        id: object.id,
        kind: object.kind,
        x: Number(object.x.toFixed(1)),
        y: Number(object.y.toFixed(1)),
      })),
    },
    session: {
      roundNumber: state.session.roundIndex + 1,
      totalRounds: state.session.totalRounds,
      roundTitle: state.session.roundPlan?.title ?? null,
      modifierLabel: state.session.roundPlan ? getModifierSummary(state.session.roundPlan.modifier) : null,
      selectedPreset: state.session.playerBuild?.presetId ?? null,
      completedRounds: state.session.completedRounds.map((round) => ({
        roundIndex: round.roundIndex,
        playerWon: round.playerWon,
        winnerLabel: round.winnerLabel,
      })),
      countdown: Number(state.session.countdown.toFixed(2)),
    },
    player: player
      ? {
          id: player.id,
          label: player.label,
          presetId: player.presetId,
          roofNumber: player.roofNumber,
          x: Number(player.x.toFixed(1)),
          y: Number(player.y.toFixed(1)),
          angle: Number(player.angle.toFixed(2)),
          velocity: {
            x: Number(player.vx.toFixed(1)),
            y: Number(player.vy.toFixed(1)),
          },
          signedSpeed: Number(signedSpeedForCar(player).toFixed(1)),
          steerAngle: Number(player.steerAngle.toFixed(3)),
          controls: player.controls,
          systems: {
            engine: Number(player.systems.engine.toFixed(2)),
            radiator: Number(player.systems.radiator.toFixed(2)),
            transmission: Number(player.systems.transmission.toFixed(2)),
            steering: Number(player.systems.steering.toFixed(2)),
            overheat: Number(player.systems.overheat.toFixed(2)),
          },
          phases: player.phases,
          lights: player.lights,
          disabled: player.disabled,
          eliminationTime:
            player.eliminationTime === null ? null : Number(player.eliminationTime.toFixed(2)),
        }
      : null,
    cars: otherCars.map((car) => ({
      id: car.id,
      label: car.label,
      presetId: car.presetId,
      roofNumber: car.roofNumber,
      archetype: car.aiArchetype ? AI_ARCHETYPE_LABELS[car.aiArchetype] : null,
      x: Number(car.x.toFixed(1)),
      y: Number(car.y.toFixed(1)),
      angle: Number(car.angle.toFixed(2)),
      targetId: car.aiState.targetId,
      disabled: car.disabled,
      phases: car.phases,
      visibleDamage: {
        front: Number(car.body.front.toFixed(2)),
        rear: Number(car.body.rear.toFixed(2)),
        left: Number(car.body.left.toFixed(2)),
        right: Number(car.body.right.toFixed(2)),
        lights: car.lights,
      },
    })),
    remainingDrivers: getActiveCars(state).length,
    winner: getWinnerCar(state)?.label ?? null,
    outlastedDrivers: getOutlastedDriverLabels(state),
    recentEvents: state.events.slice(-4).map((event) => ({
      text: event.text,
      kind: event.kind,
      ttl: Number(event.ttl.toFixed(2)),
    })),
    recentCollisions: state.recentCollisions.slice(-4).map((collision) => ({
      aId: collision.aId,
      bId: collision.bId,
      severity: Number(collision.severity.toFixed(2)),
      damageSeverity: Number(collision.damageSeverity.toFixed(2)),
      zoneA: collision.zoneA,
      zoneB: collision.zoneB,
    })),
    roundSummary: state.session.lastRoundSummary,
    effects: {
      smokePuffs: state.smokePuffs.length,
      smokePreview: state.smokePuffs.slice(-6).map((puff) => ({
        sourceCarId: puff.sourceCarId,
        x: Number(puff.x.toFixed(1)),
        y: Number(puff.y.toFixed(1)),
        age: Number(puff.age.toFixed(2)),
        size: Number(puff.size.toFixed(1)),
        density: Number(puff.density.toFixed(2)),
        flame: Number(puff.flame.toFixed(2)),
      })),
      debrisParticles: state.debrisParticles.length,
      debrisPreview: getRecentDebrisSummary(state),
      dustPuffs: state.dustPuffs.length,
      camera: {
        shake: Number(state.camera.shake.toFixed(2)),
        nudgeX: Number(state.camera.nudgeX.toFixed(2)),
        nudgeY: Number(state.camera.nudgeY.toFixed(2)),
        freezeTime: Number(state.camera.freezeTime.toFixed(3)),
      },
    },
  };
  return JSON.stringify(payload);
}
