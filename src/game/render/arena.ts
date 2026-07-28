import type { ArenaObject, GameState, MudZone } from "../types";

const arenaLayerCache = new Map<string, CanvasImageSource>();

function drawMudZones(
  ctx: CanvasRenderingContext2D,
  mudZones: MudZone[],
): void {
  ctx.save();
  for (const zone of mudZones) {
    const gradient = ctx.createLinearGradient(
      zone.x,
      zone.y,
      zone.x + zone.width,
      zone.y + zone.height,
    );
    gradient.addColorStop(0, "rgba(118, 79, 42, 0.32)");
    gradient.addColorStop(1, "rgba(74, 48, 22, 0.4)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(zone.x, zone.y, zone.width, zone.height, 38);
    ctx.fill();
    ctx.strokeStyle = "rgba(77, 47, 16, 0.24)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawArena(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height, wallPadding, mudZones } = state.arena;
  const variant = state.currentRoundPlan?.arenaVariant ?? "classic";
  const dirt = ctx.createLinearGradient(0, 0, 0, height);
  dirt.addColorStop(0, variant === "junkyard" ? "#d5a15d" : "#d8ad65");
  dirt.addColorStop(0.5, variant === "mud_pit" ? "#b97b39" : "#c88b46");
  dirt.addColorStop(1, variant === "junkyard" ? "#7c4b24" : "#8d5328");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 127.5) % width;
    const y = (i * 93.2) % height;
    ctx.fillStyle = i % 2 === 0 ? "#7e4d28" : "#e3bf79";
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      30 + (i % 5) * 18,
      12 + (i % 3) * 8,
      i,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();

  if (mudZones.length > 0) {
    drawMudZones(ctx, mudZones);
  }

  ctx.save();
  ctx.strokeStyle = "#f7e9b8";
  ctx.lineWidth = 28;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(
    wallPadding,
    wallPadding,
    width - wallPadding * 2,
    height - wallPadding * 2,
  );
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 247, 223, 0.18)";
  ctx.lineWidth = 4;
  const innerPadding = wallPadding + 56;
  ctx.strokeRect(
    innerPadding,
    innerPadding,
    width - innerPadding * 2,
    height - innerPadding * 2,
  );
  ctx.restore();
}

function getArenaLayerKey(state: GameState): string {
  const { width, height, wallPadding } = state.arena;
  return [
    width,
    height,
    wallPadding,
    state.currentRoundPlan?.arenaVariant ?? "classic",
  ].join(":");
}

function createArenaLayer(state: GameState): CanvasImageSource | null {
  const { width, height } = state.arena;
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas === "function") {
    canvas = new OffscreenCanvas(width, height);
  } else if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
  } else {
    return null;
  }
  const layerContext = canvas.getContext("2d");
  if (!layerContext) {
    return null;
  }
  drawArena(layerContext as CanvasRenderingContext2D, state);
  return canvas;
}

export function drawCachedArena(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  if (typeof ctx.drawImage !== "function") {
    drawArena(ctx, state);
    return;
  }
  const key = getArenaLayerKey(state);
  let layer = arenaLayerCache.get(key);
  if (!layer) {
    layer = createArenaLayer(state) ?? undefined;
    if (!layer) {
      drawArena(ctx, state);
      return;
    }
    arenaLayerCache.set(key, layer);
  }
  ctx.drawImage(layer, 0, 0);
}

export function drawArenaObject(
  ctx: CanvasRenderingContext2D,
  object: ArenaObject,
): void {
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.rotate(object.rotation);
  if (object.kind === "tire") {
    ctx.fillStyle = "#2c231d";
    ctx.beginPath();
    ctx.arc(0, 0, object.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9d8662";
    ctx.beginPath();
    ctx.arc(0, 0, object.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 236, 201, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = "#6c5a4a";
    ctx.beginPath();
    ctx.roundRect(
      -object.radius * 1.2,
      -object.radius * 0.8,
      object.radius * 2.4,
      object.radius * 1.6,
      8,
    );
    ctx.fill();
    ctx.fillStyle = "rgba(198, 164, 114, 0.5)";
    ctx.fillRect(
      -object.radius * 0.5,
      -object.radius * 0.22,
      object.radius * 1.1,
      object.radius * 0.44,
    );
  }
  ctx.restore();
}
