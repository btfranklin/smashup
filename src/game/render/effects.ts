import type {
  CarFragment,
  DebrisParticle,
  DustPuff,
  SmokePuff,
} from "../types";

const SMOKE_SPRITE_SIZE = 96;
const SMOKE_SPRITE_RADIUS = SMOKE_SPRITE_SIZE / 2;
const SMOKE_QUANTIZATION_INTERVALS = 32;
const SMOKE_QUANTIZED_VALUE_COUNT = SMOKE_QUANTIZATION_INTERVALS + 1;
const FLAME_SPRITE_CACHE_CAPACITY = 128;

type SmokeSpriteSurface = OffscreenCanvas | HTMLCanvasElement;

type SmokeSpriteResources = {
  shellSprites: Array<SmokeSpriteSurface | undefined>;
  flameSprites: Map<number, SmokeSpriteSurface>;
};

const smokeSpriteResources = new WeakMap<
  CanvasRenderingContext2D,
  SmokeSpriteResources
>();
const fragmentPathCache = new WeakMap<CarFragment, Path2D>();

function quantizedIndex(value: number): number {
  return Math.round(
    Math.max(0, Math.min(1, value)) * SMOKE_QUANTIZATION_INTERVALS,
  );
}

function quantizedValue(index: number): number {
  return index / SMOKE_QUANTIZATION_INTERVALS;
}

function createSmokeSpriteSurface(
  destination: CanvasRenderingContext2D,
): SmokeSpriteSurface {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(SMOKE_SPRITE_SIZE, SMOKE_SPRITE_SIZE);
  }

  const ownerDocument = destination.canvas.ownerDocument;
  if (!ownerDocument) {
    throw new Error(
      "Smoke sprite rendering requires OffscreenCanvas or a canvas owner document.",
    );
  }
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = SMOKE_SPRITE_SIZE;
  canvas.height = SMOKE_SPRITE_SIZE;
  return canvas;
}

function getSpriteContext(
  surface: SmokeSpriteSurface,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const context = surface.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) {
    throw new Error("Smoke sprite surface has no 2D rendering context.");
  }
  return context;
}

function createShellSprite(
  destination: CanvasRenderingContext2D,
  densityIndex: number,
): SmokeSpriteSurface {
  const surface = createSmokeSpriteSurface(destination);
  const spriteContext = getSpriteContext(surface);

  const density = quantizedValue(densityIndex);
  const shellGradient = spriteContext.createRadialGradient(
    SMOKE_SPRITE_RADIUS * 0.8,
    SMOKE_SPRITE_RADIUS * 0.75,
    SMOKE_SPRITE_RADIUS * 0.15,
    SMOKE_SPRITE_RADIUS,
    SMOKE_SPRITE_RADIUS,
    SMOKE_SPRITE_RADIUS,
  );
  shellGradient.addColorStop(
    0,
    `rgba(${Math.round(118 - density * 48)}, ${Math.round(114 - density * 44)}, ${Math.round(108 - density * 40)}, 0.8)`,
  );
  shellGradient.addColorStop(
    0.55,
    `rgba(${Math.round(72 - density * 30)}, ${Math.round(68 - density * 28)}, ${Math.round(64 - density * 26)}, 1)`,
  );
  shellGradient.addColorStop(1, "rgba(16, 14, 13, 0.82)");
  spriteContext.fillStyle = shellGradient;
  spriteContext.beginPath();
  spriteContext.arc(
    SMOKE_SPRITE_RADIUS,
    SMOKE_SPRITE_RADIUS,
    SMOKE_SPRITE_RADIUS,
    0,
    Math.PI * 2,
  );
  spriteContext.fill();
  return surface;
}

function createFlameSprite(
  destination: CanvasRenderingContext2D,
  flameIndex: number,
  lifeIndex: number,
): SmokeSpriteSurface {
  const surface = createSmokeSpriteSurface(destination);
  const spriteContext = getSpriteContext(surface);

  const flame = quantizedValue(flameIndex);
  const life = quantizedValue(lifeIndex);
  const flameRadius =
    SMOKE_SPRITE_RADIUS * (0.36 + flame * 0.18) * life;
  const flameGradient = spriteContext.createRadialGradient(
    SMOKE_SPRITE_RADIUS * 0.76,
    SMOKE_SPRITE_RADIUS * 0.84,
    0,
    SMOKE_SPRITE_RADIUS,
    SMOKE_SPRITE_RADIUS,
    Math.max(flameRadius, 1),
  );
  flameGradient.addColorStop(0, "rgba(255, 244, 186, 0.95)");
  flameGradient.addColorStop(0.34, "rgba(255, 170, 64, 0.88)");
  flameGradient.addColorStop(0.68, "rgba(214, 78, 22, 0.62)");
  flameGradient.addColorStop(1, "rgba(28, 18, 16, 0.1)");
  spriteContext.fillStyle = flameGradient;
  spriteContext.beginPath();
  spriteContext.arc(
    SMOKE_SPRITE_RADIUS * 0.94,
    SMOKE_SPRITE_RADIUS * 0.9,
    flameRadius,
    0,
    Math.PI * 2,
  );
  spriteContext.fill();
  return surface;
}

function getSmokeSpriteResources(
  destination: CanvasRenderingContext2D,
): SmokeSpriteResources {
  const cached = smokeSpriteResources.get(destination);
  if (cached) {
    return cached;
  }

  const resources: SmokeSpriteResources = {
    shellSprites: new Array<SmokeSpriteSurface | undefined>(
      SMOKE_QUANTIZED_VALUE_COUNT,
    ),
    flameSprites: new Map(),
  };
  smokeSpriteResources.set(destination, resources);
  return resources;
}

function getShellSprite(
  destination: CanvasRenderingContext2D,
  resources: SmokeSpriteResources,
  densityIndex: number,
): SmokeSpriteSurface {
  const cached = resources.shellSprites[densityIndex];
  if (cached) {
    return cached;
  }
  const sprite = createShellSprite(destination, densityIndex);
  resources.shellSprites[densityIndex] = sprite;
  return sprite;
}

function getFlameSprite(
  destination: CanvasRenderingContext2D,
  resources: SmokeSpriteResources,
  flameIndex: number,
  lifeIndex: number,
): SmokeSpriteSurface {
  const cacheKey = flameIndex * SMOKE_QUANTIZED_VALUE_COUNT + lifeIndex;
  const cached = resources.flameSprites.get(cacheKey);
  if (cached) {
    resources.flameSprites.delete(cacheKey);
    resources.flameSprites.set(cacheKey, cached);
    return cached;
  }

  const sprite = createFlameSprite(destination, flameIndex, lifeIndex);
  if (resources.flameSprites.size >= FLAME_SPRITE_CACHE_CAPACITY) {
    const oldestKey = resources.flameSprites.keys().next().value;
    if (oldestKey !== undefined) {
      resources.flameSprites.delete(oldestKey);
    }
  }
  resources.flameSprites.set(cacheKey, sprite);
  return sprite;
}

export function drawSmokePuffs(
  ctx: CanvasRenderingContext2D,
  puffs: SmokePuff[],
): void {
  if (puffs.length === 0) {
    return;
  }

  ctx.save();
  const baseAlpha = ctx.globalAlpha;
  const resources = getSmokeSpriteResources(ctx);
  for (const puff of puffs) {
    const life = 1 - puff.age / puff.ttl;
    const radius = puff.size + (1 - life) * (12 + puff.density * 8);
    const smokeAlpha = life * (0.16 + puff.density * 0.34);
    const shellSprite = getShellSprite(
      ctx,
      resources,
      quantizedIndex(puff.density),
    );
    const diameter = radius * 2;
    ctx.globalAlpha = baseAlpha * smokeAlpha;
    ctx.drawImage(
      shellSprite,
      puff.x - radius,
      puff.y - radius,
      diameter,
      diameter,
    );

    if (puff.flame > 0.02) {
      const flameSprite = getFlameSprite(
        ctx,
        resources,
        quantizedIndex(puff.flame),
        quantizedIndex(life),
      );
      ctx.globalAlpha = baseAlpha * life * puff.flame;
      ctx.drawImage(
        flameSprite,
        puff.x - radius,
        puff.y - radius,
        diameter,
        diameter,
      );
    }
  }
  ctx.restore();
}

export function drawDebrisParticles(
  ctx: CanvasRenderingContext2D,
  particles: DebrisParticle[],
): void {
  if (particles.length === 0) {
    return;
  }

  ctx.save();
  for (const particle of particles) {
    const life = 1 - particle.age / particle.ttl;
    const alpha = life * 0.85;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillStyle = `rgba(72, 64, 54, ${alpha})`;
    ctx.fillRect(
      -particle.size * 0.6,
      -particle.size * 0.35,
      particle.size * 1.2,
      particle.size * 0.7,
    );
    ctx.fillStyle = `rgba(182, 154, 112, ${alpha * particle.tone})`;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawCarFragments(
  ctx: CanvasRenderingContext2D,
  fragments: CarFragment[],
): void {
  if (fragments.length === 0) {
    return;
  }

  ctx.save();
  for (const fragment of fragments) {
    ctx.save();
    ctx.translate(fragment.x, fragment.y);
    ctx.rotate(fragment.rotation);
    ctx.fillStyle = fragment.color;
    ctx.strokeStyle = fragment.edgeColor;
    ctx.lineWidth = 1.2;
    let path = fragmentPathCache.get(fragment);
    if (!path) {
      const createdPath = new Path2D();
      fragment.points.forEach((point, index) => {
        if (index === 0) {
          createdPath.moveTo(point.x, point.y);
        } else {
          createdPath.lineTo(point.x, point.y);
        }
      });
      createdPath.closePath();
      fragmentPathCache.set(fragment, createdPath);
      path = createdPath;
    }
    ctx.fill(path);
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

export function drawDustPuffs(
  ctx: CanvasRenderingContext2D,
  puffs: DustPuff[],
): void {
  if (puffs.length === 0) {
    return;
  }
  ctx.save();
  for (const puff of puffs) {
    const life = 1 - puff.age / puff.ttl;
    const radius = puff.size + (1 - life) * 10;
    const alpha = puff.alpha * life;
    ctx.fillStyle = `rgba(${Math.round(188 * puff.tone)}, ${Math.round(144 * puff.tone)}, 88, ${alpha})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
