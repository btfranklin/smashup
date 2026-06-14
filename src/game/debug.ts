import { AI_ARCHETYPE_LABELS, getModifierSummary } from "./content";
import { getRecentDebrisSummary } from "./debris";
import { signedSpeedForCar } from "./math";
import {
  getActiveCars,
  getOutlastedDriverLabels,
  getPlayerCar,
  getWinnerCar,
} from "./selectors";
import type { Car, GameState } from "./types";

function fixed(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function serializeCoordinates() {
  return {
    origin: "top-left",
    xAxis: "right",
    yAxis: "down",
  };
}

function serializePreviewCar(car: Car | null) {
  return car
    ? {
        label: car.label,
        presetId: car.presetId,
        roofNumber: car.roofNumber,
        systems: car.systems,
        phases: car.phases,
        body: car.body,
        lights: car.lights,
        disabled: car.disabled,
      }
    : null;
}

function serializePreviewEffects(state: GameState) {
  return {
    smokePuffs: state.smokePuffs.length,
    smokePreview: state.smokePuffs.map((puff) => ({
      x: fixed(puff.x, 1),
      y: fixed(puff.y, 1),
      size: fixed(puff.size, 1),
      density: fixed(puff.density, 2),
      flame: fixed(puff.flame, 2),
    })),
  };
}

function serializePreviewState(state: GameState) {
  const previewCar = getPlayerCar(state) ?? state.cars[0] ?? null;
  return {
    mode: "car_preview",
    preview: state.preview,
    arena: {
      width: state.arena.width,
      height: state.arena.height,
      coordinates: serializeCoordinates(),
    },
    car: serializePreviewCar(previewCar),
    effects: serializePreviewEffects(state),
  };
}

function serializeArena(state: GameState) {
  return {
    width: state.arena.width,
    height: state.arena.height,
    wallPadding: state.arena.wallPadding,
    variant: state.arena.variant,
    modifier: state.arena.modifier,
    title: state.arena.title,
    coordinates: serializeCoordinates(),
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
      x: fixed(object.x, 1),
      y: fixed(object.y, 1),
    })),
  };
}

function serializeSession(state: GameState) {
  return {
    roundNumber: state.session.roundIndex + 1,
    totalRounds: state.session.totalRounds,
    roundTitle: state.session.roundPlan?.title ?? null,
    modifierLabel: state.session.roundPlan
      ? getModifierSummary(state.session.roundPlan.modifier)
      : null,
    selectedPreset: state.session.playerBuild?.presetId ?? null,
    completedRounds: state.session.completedRounds.map((round) => ({
      roundIndex: round.roundIndex,
      playerWon: round.playerWon,
      winnerLabel: round.winnerLabel,
    })),
    countdown: fixed(state.session.countdown, 2),
  };
}

function serializePlayer(car: Car | undefined) {
  return car
    ? {
        id: car.id,
        label: car.label,
        presetId: car.presetId,
        roofNumber: car.roofNumber,
        x: fixed(car.x, 1),
        y: fixed(car.y, 1),
        angle: fixed(car.angle, 2),
        velocity: {
          x: fixed(car.vx, 1),
          y: fixed(car.vy, 1),
        },
        signedSpeed: fixed(signedSpeedForCar(car), 1),
        steerAngle: fixed(car.steerAngle, 3),
        controls: car.controls,
        systems: {
          engine: fixed(car.systems.engine, 2),
          radiator: fixed(car.systems.radiator, 2),
          transmission: fixed(car.systems.transmission, 2),
          steering: fixed(car.systems.steering, 2),
          overheat: fixed(car.systems.overheat, 2),
        },
        phases: car.phases,
        lights: car.lights,
        disabled: car.disabled,
        eliminationTime:
          car.eliminationTime === null ? null : fixed(car.eliminationTime, 2),
      }
    : null;
}

function serializeOpponentCar(car: Car) {
  return {
    id: car.id,
    label: car.label,
    presetId: car.presetId,
    roofNumber: car.roofNumber,
    archetype: car.aiArchetype ? AI_ARCHETYPE_LABELS[car.aiArchetype] : null,
    x: fixed(car.x, 1),
    y: fixed(car.y, 1),
    angle: fixed(car.angle, 2),
    targetId: car.aiState.targetId,
    disabled: car.disabled,
    phases: car.phases,
    visibleDamage: {
      front: fixed(car.body.front, 2),
      rear: fixed(car.body.rear, 2),
      left: fixed(car.body.left, 2),
      right: fixed(car.body.right, 2),
      lights: car.lights,
    },
  };
}

function serializeRecentEvents(state: GameState) {
  return state.events.slice(-4).map((event) => ({
    text: event.text,
    kind: event.kind,
    ttl: fixed(event.ttl, 2),
  }));
}

function serializeRecentCollisions(state: GameState) {
  return state.recentCollisions.slice(-4).map((collision) => ({
    aId: collision.aId,
    bId: collision.bId,
    severity: fixed(collision.severity, 2),
    damageSeverity: fixed(collision.damageSeverity, 2),
    zoneA: collision.zoneA,
    zoneB: collision.zoneB,
  }));
}

function serializeEffects(state: GameState) {
  return {
    smokePuffs: state.smokePuffs.length,
    smokePreview: state.smokePuffs.slice(-6).map((puff) => ({
      sourceCarId: puff.sourceCarId,
      x: fixed(puff.x, 1),
      y: fixed(puff.y, 1),
      age: fixed(puff.age, 2),
      size: fixed(puff.size, 1),
      density: fixed(puff.density, 2),
      flame: fixed(puff.flame, 2),
    })),
    debrisParticles: state.debrisParticles.length,
    debrisPreview: getRecentDebrisSummary(state),
    dustPuffs: state.dustPuffs.length,
    camera: {
      shake: fixed(state.camera.shake, 2),
      nudgeX: fixed(state.camera.nudgeX, 2),
      nudgeY: fixed(state.camera.nudgeY, 2),
      freezeTime: fixed(state.camera.freezeTime, 3),
    },
  };
}

function serializeRunningState(state: GameState) {
  const player = getPlayerCar(state);
  const otherCars = [...state.cars]
    .filter((car) => !car.isPlayer)
    .sort((a, b) => a.id - b.id);
  return {
    mode: state.mode,
    arena: serializeArena(state),
    session: serializeSession(state),
    player: serializePlayer(player),
    cars: otherCars.map(serializeOpponentCar),
    remainingDrivers: getActiveCars(state).length,
    winner: getWinnerCar(state)?.label ?? null,
    outlastedDrivers: getOutlastedDriverLabels(state),
    recentEvents: serializeRecentEvents(state),
    recentCollisions: serializeRecentCollisions(state),
    roundSummary: state.session.lastRoundSummary,
    effects: serializeEffects(state),
  };
}

export function renderGameToText(state: GameState): string {
  return JSON.stringify(
    state.mode === "car_preview"
      ? serializePreviewState(state)
      : serializeRunningState(state),
  );
}
