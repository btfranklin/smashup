import { updateAi } from "./ai";
import { captureCarCondition } from "./conditions";
import { getKnockoutCause, getCarSystemPhases } from "./damage";
import { spawnImpactDebris, updateDebrisEffects } from "./debris";
import { spawnCollisionDust, spawnSlipDust, updateDustEffects } from "./dust";
import {
  resolveArenaObjectInteractions,
  resolveCarCollisions,
  stepArenaObjects,
  stepCar,
} from "./physics";
import {
  getActiveCars,
  getCarById,
  getPlayerCar,
  getWinnerCar,
} from "./selectors";
import { updateSmokeEffects } from "./smoke";
import type {
  Car,
  EventMessage,
  GameState,
  RoundSummary,
  SystemName,
} from "./types";

export function pushEvent(
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

export function resetRoundStats(state: GameState): void {
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
    survivalTime: Number(
      (state.elapsed - state.roundStats.startElapsed).toFixed(1),
    ),
    eliminatedByLabel: eliminatedBy?.label ?? null,
    playerKnockouts: [...state.roundStats.playerKnockouts],
    biggestHitLabel: state.roundStats.biggestHitLabel,
    biggestHitSeverity: Number(state.roundStats.biggestHitSeverity.toFixed(2)),
    knockoutReason: !playerWon && player ? getKnockoutReason(player) : null,
  };
}

function refreshPhaseEvents(state: GameState, car: Car): void {
  const nextPhases = getCarSystemPhases(car);
  for (const system of [
    "engine",
    "radiator",
    "transmission",
    "steering",
  ] as const) {
    if (car.phases[system] !== nextPhases[system]) {
      if (car.isPlayer && nextPhases[system] !== "healthy") {
        state.pendingSystemEvents.push({
          carId: car.id,
          system,
          phase: nextPhases[system],
        });
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

  const strongest = [...state.recentCollisions].sort(
    (a, b) => b.severity - a.severity,
  )[0];
  if (strongest.severity > state.roundStats.biggestHitSeverity) {
    const a = getCarById(state, strongest.aId);
    const b = getCarById(state, strongest.bId);
    state.roundStats.biggestHitSeverity = strongest.severity;
    state.roundStats.biggestHitLabel =
      a && b ? `${a.label} into ${b.label}` : null;
  }

  const playerInvolved =
    strongest.aId === state.playerId || strongest.bId === state.playerId;
  const qualifiesForShake =
    (playerInvolved && strongest.severity >= 0.84) ||
    (!playerInvolved && strongest.severity >= 0.93);
  if (qualifiesForShake) {
    const scale = playerInvolved ? 1 : 0.85;
    state.camera.shake = Math.max(
      state.camera.shake,
      strongest.severity * 4.8 * scale,
    );
    state.camera.nudgeX +=
      strongest.normal.x * strongest.severity * 2.8 * scale;
    state.camera.nudgeY +=
      strongest.normal.y * strongest.severity * 2.8 * scale;
  }
  if (playerInvolved && strongest.severity >= 0.94) {
    state.camera.freezeTime = Math.max(state.camera.freezeTime, 0.02);
  }
  const strongestA = getCarById(state, strongest.aId);
  const strongestB = getCarById(state, strongest.bId);
  const hasDisabledParticipant = Boolean(
    strongestA?.disabled || strongestB?.disabled,
  );
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
      .filter(
        (collision) => collision.aId === car.id || collision.bId === car.id,
      )
      .sort((a, b) => b.damageSeverity - a.damageSeverity)[0];
    const attackerId = relevant
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
        attacker
          ? `${attacker.label} finished you`
          : state.roundStats.knockoutReason,
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
    const previousCountdown = state.session.countdown;
    state.session.countdown = Math.max(0, state.session.countdown - dt);
    if (previousCountdown > 1 && state.session.countdown <= 1) {
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

  const beforeDisabled = new Map(
    state.cars.map((car) => [car.id, car.disabled]),
  );
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
    state.winnerId = alive.length === 1 ? (alive[0]?.id ?? null) : null;
    state.outlastedDriverIds = alive
      .filter((car) => car.id !== state.playerId)
      .map((car) => car.id);
    state.session.playerCondition = captureCarCondition(playerCar);
    state.session.lastRoundSummary = makeRoundSummary(state, false);
    state.session.completedRounds.push(state.session.lastRoundSummary);
    state.mode = "round_results";
  } else if (alive.length <= 1) {
    state.winnerId = alive[0]?.id ?? null;
    state.outlastedDriverIds = [];
    if (playerCar) {
      state.session.playerCondition = captureCarCondition(playerCar);
    }
    state.session.lastRoundSummary = makeRoundSummary(state, true);
    state.session.completedRounds.push(state.session.lastRoundSummary);
    state.mode = "round_results";
    pushEvent(state, "Round Won!", "result", 1, 2.4);
  }

  state.tick += 1;
  state.elapsed += dt;
}
