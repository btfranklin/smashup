import { drawArenaObject, drawCachedArena } from "./render/arena";
import { drawCar } from "./render/car";
import {
  drawCarFragments,
  drawDebrisParticles,
  drawDustPuffs,
  drawSmokePuffs,
} from "./render/effects";
import {
  drawEventFeed,
  drawHud,
  drawIntroOverlay,
  drawNonRunningOverlay,
  drawPreviewBackground,
} from "./render/overlays";
import type { GameState } from "./types";

export { drawCar } from "./render/car";
export { getPhaseColor } from "./render/overlays";

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  ctx.clearRect(0, 0, state.arena.width, state.arena.height);

  if (state.mode === "car_preview") {
    drawPreviewBackground(ctx, state.arena.width, state.arena.height);
    const previewCar = state.cars[0];
    const previewScale = 3.4;
    ctx.save();
    ctx.translate(state.arena.width * 0.5, state.arena.height * 0.52);
    ctx.scale(previewScale, previewScale);
    ctx.translate(-previewCar.x, -previewCar.y);
    for (const car of state.cars) {
      drawCar(ctx, car, { showPlayerOutline: false });
    }
    drawSmokePuffs(ctx, state.smokePuffs);
    ctx.restore();
    return;
  }

  const { x: shakeX, y: shakeY } = getCameraOffset(state);

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawCachedArena(ctx, state);
  for (const object of state.arena.objects) {
    drawArenaObject(ctx, object);
  }
  drawCarFragments(ctx, state.carFragments);
  drawDustPuffs(ctx, state.dustPuffs);
  drawDebrisParticles(ctx, state.debrisParticles);
  for (const car of state.cars) {
    drawCar(ctx, car);
  }
  drawSmokePuffs(ctx, state.smokePuffs);
  ctx.restore();

  drawHud(ctx, state);
  drawEventFeed(ctx, state.events);

  if (state.mode === "intro") {
    drawIntroOverlay(ctx, state);
  } else if (state.mode !== "running" && state.mode !== "spectating") {
    drawNonRunningOverlay(ctx, state.arena.width, state.arena.height);
  }
}

export function getCameraOffset(
  state: Pick<GameState, "tick" | "camera">,
): { x: number; y: number } {
  return {
    x:
      Math.sin(state.tick * 0.8) * state.camera.shake * 0.5 +
      state.camera.nudgeX * 0.7,
    y:
      Math.cos(state.tick * 0.9) * state.camera.shake * 0.3 +
      state.camera.nudgeY * 0.7,
  };
}
