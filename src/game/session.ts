import { createArena, createEmptyArena } from "./arena";
import { generateCareerRoundPlans } from "./career";
import {
  CAR_PREVIEW_SCENARIOS,
  createDefaultPlayerBuild,
} from "./content";
import { cloneCondition, createFreshCondition } from "./conditions";
import { pushEvent } from "./events";
import { createRoundStats, resetRoundStats } from "./roundStats";
import {
  createCarPreviewCar,
  createMenuPreviewCars,
  createRoundCars,
} from "./roster";
import {
  applyBuildUpgrade,
  serviceCondition,
  towConditionToRunnableMinimum,
} from "./upgrades";
import type {
  Car,
  CarPreviewScenarioId,
  CarPresetId,
  GameState,
  SessionUpgradeId,
} from "./types";

function createCameraState(): GameState["camera"] {
  return { shake: 0, nudgeX: 0, nudgeY: 0, freezeTime: 0 };
}

function clearRoundRuntimeState(state: GameState): void {
  state.winnerId = null;
  state.outlastedDriverIds = [];
  state.recentCollisions = [];
  state.smokePuffs = [];
  state.debrisParticles = [];
  state.carFragments = [];
  state.dustPuffs = [];
  state.events = [];
  state.pendingSystemEvents = [];
  state.camera = createCameraState();
  state.tick = 0;
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

function prepareRound(state: GameState, roundIndex: number): void {
  const roundPlan = state.session.roundPlans[roundIndex];
  if (!roundPlan) {
    throw new Error(`Career round ${roundIndex + 1} is not configured.`);
  }
  state.session.roundIndex = roundIndex;
  state.currentRoundPlan = roundPlan;
  state.arena = createArena(roundPlan.arenaVariant);
  const build =
    state.session.playerBuild ?? createDefaultPlayerBuild("bulldozer");
  const condition = state.session.playerCondition ?? createFreshCondition();
  state.cars = createRoundCars(build, condition, state.arena);
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
  if (roundPlan.modifier === "redline") {
    for (const car of state.cars) {
      car.systems.overheat = Math.max(0.55, car.systems.overheat);
    }
  }
  if (
    roundPlan.modifier === "lights_out" ||
    roundPlan.modifier === "redline"
  ) {
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
  const arena = createArena("classic");
  const state: GameState = {
    mode: "menu",
    currentRoundPlan: null,
    arena,
    preview: null,
    session: {
      roundIndex: 0,
      runSeed: null,
      roundPlans: [],
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
    carFragments: [],
    nextCarFragmentId: 1,
    dustPuffs: [],
    nextDustPuffId: 1,
    events: [],
    nextEventId: 1,
    camera: createCameraState(),
    pendingSystemEvents: [],
    roundStats: createRoundStats(),
  };
  state.cars = createMenuPreviewCars(arena);
  return state;
}

export function createCarPreviewState(
  presetId: CarPresetId,
  scenarioId: CarPreviewScenarioId,
): GameState {
  const state = createInitialState();
  const scenario = CAR_PREVIEW_SCENARIOS[scenarioId];
  const previewGeometry = {
    width: 900,
    height: 720,
    wallPadding: 0,
  };
  const car = createCarPreviewCar(
    presetId,
    scenario.condition,
    Boolean(scenario.disabled),
    previewGeometry,
  );

  state.mode = "car_preview";
  state.preview = {
    kind: "car",
    presetId,
    scenario: scenarioId,
  };
  state.arena = createEmptyArena(previewGeometry);
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
  state.carFragments = [];
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
  runSeed = Math.floor(Math.random() * 0x1_0000_0000) >>> 0,
): void {
  state.session.runSeed = runSeed >>> 0;
  state.session.roundPlans = generateCareerRoundPlans(state.session.runSeed);
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
  if (state.session.roundIndex >= state.session.roundPlans.length - 1) {
    state.mode = "career_over";
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
  applyBuildUpgrade(state.session.playerBuild, upgradeId);
  const condition =
    state.session.lastRoundSummary?.playerWrecked
      ? towConditionToRunnableMinimum(state.session.playerCondition)
      : state.session.playerCondition;
  state.session.playerCondition = serviceCondition(
    condition,
    upgradeId,
  );
  prepareRound(state, state.session.roundIndex + 1);
}
