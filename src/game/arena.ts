import {
  ARENA_MUD_ZONE_LAYOUTS,
  ARENA_OBJECT_LAYOUTS,
} from "./content";
import type { ArenaVariantId } from "./contentIds";
import type {
  ArenaObject,
  ArenaGeometry,
  ArenaState,
  Vec2,
} from "./types";

const JUNK_CORNER_RADIUS = 8;
const JUNK_CORNER_SEGMENTS = 3;

type JunkOutlineCacheEntry = {
  radius: number;
  points: Vec2[];
};

const junkOutlineCache = new WeakMap<ArenaObject, JunkOutlineCacheEntry>();

export function getArenaObjectOutline(object: ArenaObject): Vec2[] | null {
  if (object.kind !== "junk") {
    return null;
  }
  const cached = junkOutlineCache.get(object);
  if (cached?.radius === object.radius) {
    return cached.points;
  }

  const halfWidth = object.radius * 1.2;
  const halfHeight = object.radius * 0.8;
  const cornerRadius = Math.min(JUNK_CORNER_RADIUS, halfWidth, halfHeight);
  const corners = [
    {
      x: halfWidth - cornerRadius,
      y: -halfHeight + cornerRadius,
      startAngle: -Math.PI * 0.5,
    },
    {
      x: halfWidth - cornerRadius,
      y: halfHeight - cornerRadius,
      startAngle: 0,
    },
    {
      x: -halfWidth + cornerRadius,
      y: halfHeight - cornerRadius,
      startAngle: Math.PI * 0.5,
    },
    {
      x: -halfWidth + cornerRadius,
      y: -halfHeight + cornerRadius,
      startAngle: Math.PI,
    },
  ];
  const points: Vec2[] = [];
  for (const corner of corners) {
    for (let step = 0; step <= JUNK_CORNER_SEGMENTS; step += 1) {
      const angle =
        corner.startAngle +
        (step / JUNK_CORNER_SEGMENTS) * Math.PI * 0.5;
      points.push({
        x: corner.x + Math.cos(angle) * cornerRadius,
        y: corner.y + Math.sin(angle) * cornerRadius,
      });
    }
  }

  junkOutlineCache.set(object, { radius: object.radius, points });
  return points;
}

export const DEFAULT_ARENA_GEOMETRY: Readonly<ArenaGeometry> = Object.freeze({
  width: 1500,
  height: 900,
  wallPadding: 54,
});

function getPlayableDimensions(geometry: ArenaGeometry): {
  width: number;
  height: number;
} {
  const width = geometry.width - geometry.wallPadding * 2;
  const height = geometry.height - geometry.wallPadding * 2;
  if (width <= 0 || height <= 0) {
    throw new RangeError("Arena wall padding must leave a playable rectangle.");
  }
  return { width, height };
}

export function materializeArenaPoint(
  geometry: ArenaGeometry,
  xRatio: number,
  yRatio: number,
): Vec2 {
  const playable = getPlayableDimensions(geometry);
  return {
    x: geometry.wallPadding + playable.width * xRatio,
    y: geometry.wallPadding + playable.height * yRatio,
  };
}

export function createArena(
  variant: ArenaVariantId,
  geometry: ArenaGeometry = DEFAULT_ARENA_GEOMETRY,
): ArenaState {
  const playable = getPlayableDimensions(geometry);
  const objectScale = Math.min(playable.width, playable.height);

  return {
    ...geometry,
    mudZones: ARENA_MUD_ZONE_LAYOUTS[variant].map((zone, index) => ({
      id: index + 1,
      x: geometry.wallPadding + playable.width * zone.xRatio,
      y: geometry.wallPadding + playable.height * zone.yRatio,
      width: playable.width * zone.widthRatio,
      height: playable.height * zone.heightRatio,
      grip: zone.grip,
    })),
    objects: ARENA_OBJECT_LAYOUTS[variant].map((object, index) => ({
      id: index + 1,
      kind: object.kind,
      x: geometry.wallPadding + playable.width * object.xRatio,
      y: geometry.wallPadding + playable.height * object.yRatio,
      radius: objectScale * object.radiusRatio,
      mass: object.mass,
      vx: 0,
      vy: 0,
      rotation: 0,
      spin: 0,
    })),
  };
}

export function createEmptyArena(geometry: ArenaGeometry): ArenaState {
  getPlayableDimensions(geometry);
  return {
    ...geometry,
    mudZones: [],
    objects: [],
  };
}
