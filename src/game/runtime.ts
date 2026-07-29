import { updateAi } from "./ai";
import { selectWreckAwards } from "./awards";
import { rankRoundCars } from "./career";
import { captureCarCondition } from "./conditions";
import {
  getEngineHealth,
  getKnockoutCause,
  getCarSystemPhases,
} from "./damage";
import { spawnImpactDebris, updateDebrisEffects } from "./debris";
import {
  pushCarFragments,
  spawnCarFragments,
  updateCarFragments,
} from "./fragments";
import { spawnCollisionDust, spawnSlipDust, updateDustEffects } from "./dust";
import { pushEvent } from "./events";
import {
  resolveArenaObjectInteractions,
  resolveCarCollisions,
  stepArenaObjects,
  stepCar,
} from "./physics";
import { recordPlayerContact } from "./roundStats";
import {
  getActiveCars,
  getCarById,
  getPlayerCar,
  isActiveCareerMode,
  requireCurrentRoundPlan,
} from "./selectors";
import { updateSmokeEffects } from "./smoke";
import type {
  Car,
  CollisionEvent,
  DamagePhase,
  GameState,
  RoundPlacement,
  RoundSummary,
  SystemName,
} from "./types";

const SYSTEM_EVENT_LABELS: Record<SystemName, string> = {
  engine: "Engine Hurt",
  radiator: "Radiator Hit",
  transmission: "Transmission Slipping",
  steering: "Steering Bent",
};

const SYSTEM_EVENT_EMPHASIS: Record<DamagePhase, number> = {
  healthy: 0.62,
  wounded: 0.62,
  failing: 0.8,
  critical: 1,
};

type PendingSystemEvent = {
  system: SystemName;
  phase: DamagePhase;
};

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
      const systems: Array<[SystemName, number]> = [
        ["engine", car.systems.engine],
        ["radiator", car.systems.radiator],
        ["transmission", car.systems.transmission],
        ["steering", car.systems.steering],
      ];
      const ordered = systems.sort((a, b) => a[1] - b[1]);
      const weakest = ordered[0][0];
      return weakest === "steering" ? "Steering Folded" : "Engine Failure";
    }
  }
}

function makeRoundSummary(
  state: GameState,
  placements: RoundPlacement[],
  completionElapsed: number,
): RoundSummary {
  const roundPlan = requireCurrentRoundPlan(state);
  const player = getPlayerCar(state);
  const winner = placements[0] ?? null;
  const playerWon = winner?.driverId === state.playerId;
  const playerWrecked = player?.disabled ?? false;
  const eliminatedBy = getCarById(state, state.roundStats.eliminatedById);
  const survivalEndElapsed =
    playerWrecked
      ? (player?.eliminationTime ?? completionElapsed)
      : completionElapsed;
  const awardIds = selectWreckAwards({
    playerWon,
    playerEngineHealth: player ? getEngineHealth(player) : 0,
    playerFrontDamage: player?.body.front ?? 0,
    playerKnockoutCount: state.roundStats.playerKnockouts.length,
    strongestPlayerHitSeverity: state.roundStats.strongestPlayerHitSeverity,
    strongestPlayerKnockoutSeverity:
      state.roundStats.strongestPlayerKnockoutSeverity,
  });
  return {
    roundNumber: roundPlan.id,
    title: roundPlan.title,
    playerWon,
    playerWrecked,
    winnerLabel: winner?.label ?? null,
    survivalTime: Number(
      Math.max(0, survivalEndElapsed - state.roundStats.startElapsed).toFixed(1),
    ),
    eliminatedByLabel: eliminatedBy?.label ?? null,
    playerKnockouts: [...state.roundStats.playerKnockouts],
    biggestHitLabel: state.roundStats.biggestHitLabel,
    biggestHitSeverity: Number(state.roundStats.biggestHitSeverity.toFixed(2)),
    knockoutReason: playerWrecked && player ? getKnockoutReason(player) : null,
    placements,
    awardIds,
  };
}

function completeRound(
  state: GameState,
  completionElapsed = state.sessionElapsed,
): void {
  requireCurrentRoundPlan(state);
  const placements = rankRoundCars(state.cars);
  state.winnerId = placements[0]?.driverId ?? null;
  const player = getPlayerCar(state);
  if (player) {
    state.session.playerCondition = captureCarCondition(player);
  }
  state.session.lastRoundSummary = makeRoundSummary(
    state,
    placements,
    completionElapsed,
  );
  state.session.completedRounds.push(state.session.lastRoundSummary);
  state.mode = "round_results";
  if (state.winnerId === state.playerId) {
    pushEvent(state, "Round Won!", "result", 1, 2.4);
  }
}

function refreshPlayerPhaseEvents(
  state: GameState,
  car: Car,
  pendingSystemEvents: PendingSystemEvent[],
): void {
  if (!car.isPlayer) {
    return;
  }
  const nextPhases = getCarSystemPhases(car);
  const previousPhases = state.roundStats.lastPlayerSystemPhases;
  if (!previousPhases) {
    state.roundStats.lastPlayerSystemPhases = nextPhases;
    return;
  }
  for (const system of [
    "engine",
    "radiator",
    "transmission",
    "steering",
  ] as const) {
    if (previousPhases[system] !== nextPhases[system]) {
      if (nextPhases[system] !== "healthy") {
        pendingSystemEvents.push({
          system,
          phase: nextPhases[system],
        });
      }
    }
  }
  state.roundStats.lastPlayerSystemPhases = nextPhases;
}

function flushPendingSystemEvents(
  state: GameState,
  pendingSystemEvents: PendingSystemEvent[],
): void {
  for (const entry of pendingSystemEvents) {
    pushEvent(
      state,
      SYSTEM_EVENT_LABELS[entry.system],
      "system",
      SYSTEM_EVENT_EMPHASIS[entry.phase],
      2.2,
    );
  }
}

function captureCarPostMutationTransitions(
  state: GameState,
  car: Car,
  transitionElapsed: number,
  pendingSystemEvents: PendingSystemEvent[],
): void {
  refreshPlayerPhaseEvents(state, car, pendingSystemEvents);
  if (car.disabled && car.eliminationTime === null) {
    car.eliminationTime = transitionElapsed;
  }
}

function getStrongestCollision(
  collisions: CollisionEvent[],
): CollisionEvent | null {
  let strongest = collisions[0] ?? null;
  for (const collision of collisions.slice(1)) {
    if (
      strongest === null ||
      collision.damageSeverity > strongest.damageSeverity ||
      (collision.damageSeverity === strongest.damageSeverity &&
        collision.severity > strongest.severity)
    ) {
      strongest = collision;
    }
  }
  return strongest;
}

function recordStrongestHit(state: GameState, strongest: CollisionEvent): void {
  if (
    strongest.damageSeverity > 0 &&
    strongest.damageSeverity > state.roundStats.biggestHitSeverity
  ) {
    const a = getCarById(state, strongest.aId);
    const b = getCarById(state, strongest.bId);
    state.roundStats.biggestHitSeverity = strongest.damageSeverity;
    state.roundStats.biggestHitLabel =
      a && b ? `${a.label} into ${b.label}` : null;
  }
}

function isPlayerCollision(state: GameState, collision: CollisionEvent): boolean {
  return collision.aId === state.playerId || collision.bId === state.playerId;
}

function wasCarActiveAtImpact(
  carId: number,
  collision: CollisionEvent,
): boolean {
  if (collision.aId === carId) {
    return collision.aActiveAtImpact;
  }
  return collision.bId === carId && collision.bActiveAtImpact;
}

function wasPlayerActiveAtImpact(
  state: GameState,
  collision: CollisionEvent,
): boolean {
  return wasCarActiveAtImpact(state.playerId, collision);
}

function wasCarDisabledByImpact(
  carId: number,
  collision: CollisionEvent,
): boolean {
  if (collision.aId === carId) {
    return collision.aDisabledByImpact;
  }
  return collision.bId === carId && collision.bDisabledByImpact;
}

function recordPlayerContactCredit(
  state: GameState,
  collisions: CollisionEvent[],
  contactElapsed: number,
): void {
  for (const collision of collisions) {
    if (
      !isPlayerCollision(state, collision) ||
      !wasPlayerActiveAtImpact(state, collision) ||
      collision.damageSeverity <= 0
    ) {
      continue;
    }
    const targetId =
      collision.aId === state.playerId ? collision.bId : collision.aId;
    recordPlayerContact(
      state.roundStats,
      targetId,
      contactElapsed,
      collision.damageSeverity,
    );
  }
}

function applyCollisionCameraDrama(
  state: GameState,
  strongest: CollisionEvent,
): void {
  const playerInvolved = isPlayerCollision(state, strongest);
  const qualifiesForShake =
    (playerInvolved && strongest.damageSeverity >= 0.48) ||
    (!playerInvolved && strongest.damageSeverity >= 0.62);
  if (qualifiesForShake) {
    const scale = playerInvolved ? 1 : 0.85;
    state.camera.shake = Math.max(
      state.camera.shake,
      strongest.damageSeverity * 4.8 * scale,
    );
    state.camera.nudgeX +=
      strongest.normal.x * strongest.damageSeverity * 2.8 * scale;
    state.camera.nudgeY +=
      strongest.normal.y * strongest.damageSeverity * 2.8 * scale;
  }
  if (playerInvolved && strongest.damageSeverity >= 0.72) {
    state.camera.freezeTime = Math.max(state.camera.freezeTime, 0.02);
  }
}

function announceImpactCallout(
  state: GameState,
  strongest: CollisionEvent,
): void {
  const strongestA = getCarById(state, strongest.aId);
  const strongestB = getCarById(state, strongest.bId);
  const hasDisabledParticipant = Boolean(
    strongestA?.disabled || strongestB?.disabled,
  );
  if (strongest.damageSeverity > 0.48 && !hasDisabledParticipant) {
    pushEvent(state, "Huge Hit!", "impact", strongest.damageSeverity, 1.2);
  }
}

function registerCollisionDrama(
  state: GameState,
  collisionElapsed: number,
): void {
  const strongest = getStrongestCollision(state.recentCollisions);
  if (!strongest) {
    return;
  }

  recordStrongestHit(state, strongest);
  recordPlayerContactCredit(
    state,
    state.recentCollisions,
    collisionElapsed,
  );
  applyCollisionCameraDrama(state, strongest);
  announceImpactCallout(state, strongest);
}

function getRecentPlayerCredit(
  state: GameState,
  car: Car,
  currentElapsed: number,
): { elapsed: number; severity: number } | null {
  const credit = state.roundStats.playerContactLedger[car.id];
  return credit &&
    currentElapsed >= credit.elapsed &&
    currentElapsed - credit.elapsed <= 4
    ? credit
    : null;
}

function registerNewEliminations(
  state: GameState,
  beforeDisabled: Map<number, boolean>,
  eliminationElapsed: number,
): void {
  for (const car of state.cars) {
    if (beforeDisabled.get(car.id) || !car.disabled) {
      continue;
    }

    const relevant = state.recentCollisions.find((collision) =>
      wasCarDisabledByImpact(car.id, collision),
    );
    const attackerId = relevant
      ? relevant.aId === car.id
        ? relevant.bId
        : relevant.aId
      : null;
    const attacker = getCarById(state, attackerId);
    const recentPlayerCredit =
      attackerId === null
        ? getRecentPlayerCredit(state, car, eliminationElapsed)
        : null;

    if (car.id === state.playerId) {
      state.roundStats.eliminatedById = attackerId;
      const knockoutReason = getKnockoutReason(car);
      pushEvent(
        state,
        attacker
          ? `${attacker.label} finished you`
          : knockoutReason,
        "result",
        1,
        2.6,
      );
    } else if (
      (attackerId === state.playerId &&
        relevant !== undefined &&
        wasPlayerActiveAtImpact(state, relevant)) ||
      recentPlayerCredit
    ) {
      const knockoutSeverity =
        attackerId === state.playerId
          ? (relevant?.damageSeverity ?? 0)
          : (recentPlayerCredit?.severity ?? 0);
      state.roundStats.strongestPlayerKnockoutSeverity = Math.max(
        state.roundStats.strongestPlayerKnockoutSeverity,
        knockoutSeverity,
      );
      if (!state.roundStats.playerKnockouts.includes(car.label)) {
        state.roundStats.playerKnockouts.push(car.label);
      }
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
  if (isActiveCareerMode(state.mode)) {
    requireCurrentRoundPlan(state);
  }

  updateDebrisEffects(state, dt);
  updateCarFragments(state, dt);
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
      state.roundStats.startElapsed = state.sessionElapsed + dt;
    }
    state.sessionElapsed += dt;
    return;
  }

  if (state.mode !== "running" && state.mode !== "spectating") {
    state.recentCollisions = [];
    state.sessionElapsed += dt;
    return;
  }

  const player = getPlayerCar(state);
  if (player?.disabled) {
    player.controls.forward = 0;
    player.controls.reverse = 0;
    player.controls.steer = 0;
  }

  if (state.camera.freezeTime > 0) {
    state.sessionElapsed += dt;
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
  const roundPlan = requireCurrentRoundPlan(state);
  const stepEndElapsed = state.sessionElapsed + dt;
  const pendingSystemEvents: PendingSystemEvent[] = [];
  for (const car of state.cars) {
    stepCar(
      car,
      dt,
      state.arena,
      roundPlan.modifier,
    );
    captureCarPostMutationTransitions(
      state,
      car,
      stepEndElapsed,
      pendingSystemEvents,
    );
  }

  stepArenaObjects(state.arena.objects, dt, state.arena);
  resolveArenaObjectInteractions(state.cars, state.arena.objects, state.arena);
  state.recentCollisions = resolveCarCollisions(state.cars);
  registerCollisionDrama(state, stepEndElapsed);
  spawnImpactDebris(state);
  spawnCarFragments(state);
  pushCarFragments(state);
  spawnCollisionDust(state);
  spawnSlipDust(state);

  for (const car of state.cars) {
    captureCarPostMutationTransitions(
      state,
      car,
      stepEndElapsed,
      pendingSystemEvents,
    );
  }

  registerNewEliminations(
    state,
    beforeDisabled,
    stepEndElapsed,
  );
  flushPendingSystemEvents(state, pendingSystemEvents);
  maybeAnnounceFinalTwo(state);

  const playerCar = getPlayerCar(state);
  const alive = getActiveCars(state);
  if (playerCar?.disabled && state.mode === "running") {
    state.outlastedDriverIds = alive
      .filter((car) => car.id !== state.playerId)
      .map((car) => car.id);
    state.session.playerCondition = captureCarCondition(playerCar);
    state.mode = "spectating";
  }
  if (alive.length <= 1) {
    completeRound(state, stepEndElapsed);
  }

  state.roundTick += 1;
  state.sessionElapsed += dt;
}

export function finishSpectatingRound(state: GameState): void {
  if (state.mode !== "spectating") {
    return;
  }
  completeRound(state);
}
