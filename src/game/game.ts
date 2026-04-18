import { updateAi } from "./ai";
import { getRecentDebrisSummary, spawnImpactDebris, updateDebrisEffects } from "./debris";
import { signedSpeedForCar } from "./math";
import { resolveCarCollisions, stepCar } from "./physics";
import { getActiveCars, getOutlastedDriverLabels, getPlayerCar, getWinnerCar } from "./selectors";
import { updateSmokeEffects } from "./smoke";
import type { Car, GameState } from "./types";

function createCar(
  id: number,
  options: {
    label: string;
    isPlayer: boolean;
    team: "left" | "right";
    color: string;
    accent: string;
    x: number;
    y: number;
    angle: number;
  },
): Car {
  return {
    id,
    label: options.label,
    isPlayer: options.isPlayer,
    team: options.team,
    color: options.color,
    accent: options.accent,
    x: options.x,
    y: options.y,
    angle: options.angle,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
    width: 52,
    length: 86,
    mass: 1260,
    controls: { steer: 0, forward: 0, reverse: 0 },
    steerAngle: 0,
    steerAngleTarget: 0,
    wheelbase: 58,
    engineForce: 128000,
    brakeForce: 42000,
    reverseForce: 144000,
    forwardMaxSpeed: 320,
    reverseMaxSpeed: 270,
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
    disabled: false,
    eliminationTime: null,
    aiState: {
      targetId: null,
      jamTimer: 0,
      resetTimer: 0,
    },
    smokeTimer: 0,
    smokeBurstCount: 0,
  };
}

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

export function createInitialState(): GameState {
  const cars: Car[] = [
    createCar(0, {
      label: "Player",
      isPlayer: true,
      team: "left",
      color: "#0e546f",
      accent: "#2ba7d7",
      x: LEFT_LINEUP[1].x,
      y: LEFT_LINEUP[1].y,
      angle: Math.PI,
    }),
    createCar(1, {
      label: "Rimshot",
      isPlayer: false,
      team: "left",
      color: "#874316",
      accent: "#d8883c",
      x: LEFT_LINEUP[0].x,
      y: LEFT_LINEUP[0].y,
      angle: Math.PI,
    }),
    createCar(2, {
      label: "Rustline",
      isPlayer: false,
      team: "left",
      color: "#487128",
      accent: "#81b640",
      x: LEFT_LINEUP[2].x,
      y: LEFT_LINEUP[2].y,
      angle: Math.PI,
    }),
    createCar(3, {
      label: "Sidewind",
      isPlayer: false,
      team: "left",
      color: "#6c3154",
      accent: "#ca71a5",
      x: LEFT_LINEUP[3].x,
      y: LEFT_LINEUP[3].y,
      angle: Math.PI,
    }),
    createCar(4, {
      label: "Backlash",
      isPlayer: false,
      team: "right",
      color: "#8a3523",
      accent: "#ef8d5f",
      x: RIGHT_LINEUP[0].x,
      y: RIGHT_LINEUP[0].y,
      angle: 0,
    }),
    createCar(5, {
      label: "Gravelord",
      isPlayer: false,
      team: "right",
      color: "#245d72",
      accent: "#78bbd7",
      x: RIGHT_LINEUP[1].x,
      y: RIGHT_LINEUP[1].y,
      angle: 0,
    }),
    createCar(6, {
      label: "Tarnish",
      isPlayer: false,
      team: "right",
      color: "#775319",
      accent: "#cfb55d",
      x: RIGHT_LINEUP[2].x,
      y: RIGHT_LINEUP[2].y,
      angle: 0,
    }),
    createCar(7, {
      label: "Mudlark",
      isPlayer: false,
      team: "right",
      color: "#4f2b5d",
      accent: "#b48bcb",
      x: RIGHT_LINEUP[3].x,
      y: RIGHT_LINEUP[3].y,
      angle: 0,
    }),
  ];

  return {
    mode: "menu",
    arena: {
      width: 1500,
      height: 900,
      wallPadding: 54,
    },
    cars,
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
  };
}

export function restartState(state: GameState): GameState {
  const fresh = createInitialState();
  state.mode = fresh.mode;
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
  return state;
}

export function startMatch(state: GameState): void {
  state.mode = "running";
  state.winnerId = null;
  state.outlastedDriverIds = [];
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
  if (!player || player.disabled) {
    return;
  }

  player.controls.steer = Number(input.right) - Number(input.left);
  player.controls.forward = input.forward ? 1 : 0;
  player.controls.reverse = input.reverse ? 1 : 0;
}

export function advanceState(state: GameState, dt: number): void {
  updateDebrisEffects(state, dt);
  updateSmokeEffects(state, dt);
  if (state.mode !== "running") {
    state.recentCollisions = [];
    return;
  }

  const player = getPlayerCar(state);
  if (player?.disabled) {
    player.controls.forward = 0;
    player.controls.reverse = 0;
    player.controls.steer = 0;
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

  for (const car of state.cars) {
    stepCar(
      car,
      dt,
      state.arena.width,
      state.arena.height,
      state.arena.wallPadding,
    );
    if (car.disabled && car.eliminationTime === null) {
      car.eliminationTime = state.elapsed;
    }
  }

  state.recentCollisions = resolveCarCollisions(state.cars);
  spawnImpactDebris(state);
  for (const car of state.cars) {
    if (car.disabled && car.eliminationTime === null) {
      car.eliminationTime = state.elapsed;
    }
  }

  const playerCar = getPlayerCar(state);
  const alive = getActiveCars(state);
  if (playerCar?.disabled) {
    state.mode = "finished";
    state.winnerId = alive.length === 1 ? alive[0]?.id ?? null : null;
    state.outlastedDriverIds = alive
      .filter((car) => car.id !== state.playerId)
      .map((car) => car.id);
  } else if (alive.length <= 1) {
    state.mode = "finished";
    state.winnerId = alive[0]?.id ?? null;
    state.outlastedDriverIds = [];
  }

  state.tick += 1;
  state.elapsed += dt;
}

export function renderGameToText(state: GameState): string {
  const player = getPlayerCar(state);
  const otherCars = [...state.cars]
    .filter((car) => !car.isPlayer)
    .sort((a, b) => {
      if (a.disabled !== b.disabled) {
        return Number(a.disabled) - Number(b.disabled);
      }
      if (a.eliminationTime === null && b.eliminationTime === null) {
        return a.id - b.id;
      }
      if (a.eliminationTime === null) {
        return -1;
      }
      if (b.eliminationTime === null) {
        return 1;
      }
      return a.eliminationTime - b.eliminationTime;
    });
  const payload = {
    mode: state.mode,
    arena: {
      width: state.arena.width,
      height: state.arena.height,
      wallPadding: state.arena.wallPadding,
      coordinates: {
        origin: "top-left",
        xAxis: "right",
        yAxis: "down",
      },
    },
    player: player
      ? {
          id: player.id,
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
          lights: player.lights,
          disabled: player.disabled,
          eliminationTime:
            player.eliminationTime === null ? null : Number(player.eliminationTime.toFixed(2)),
        }
      : null,
    cars: otherCars.map((car) => ({
        id: car.id,
        label: car.label,
        x: Number(car.x.toFixed(1)),
        y: Number(car.y.toFixed(1)),
        angle: Number(car.angle.toFixed(2)),
        targetId: car.aiState.targetId,
        disabled: car.disabled,
        eliminationTime:
          car.eliminationTime === null ? null : Number(car.eliminationTime.toFixed(2)),
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
    recentCollisions: state.recentCollisions.slice(-4).map((collision) => ({
      aId: collision.aId,
      bId: collision.bId,
      severity: Number(collision.severity.toFixed(2)),
      damageSeverity: Number(collision.damageSeverity.toFixed(2)),
      zoneA: collision.zoneA,
      zoneB: collision.zoneB,
    })),
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
    },
  };
  return JSON.stringify(payload);
}
