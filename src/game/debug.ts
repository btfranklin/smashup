import { AI_ARCHETYPE_LABELS, getModifierSummary } from "./content";
import { getRecentDebrisSummary } from "./debris";
import { signedSpeedForCar } from "./math";
import {
  getActiveCars,
  getOutlastedDriverLabels,
  getPlayerCar,
  getWinnerCar,
} from "./selectors";
import type { GameState } from "./types";

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
      modifierLabel: state.session.roundPlan
        ? getModifierSummary(state.session.roundPlan.modifier)
        : null,
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
            player.eliminationTime === null
              ? null
              : Number(player.eliminationTime.toFixed(2)),
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
