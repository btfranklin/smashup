import {
  ARENA_MUD_ZONE_LAYOUTS,
  ARENA_OBJECT_LAYOUTS,
} from "./content";
import type { ArenaVariantId } from "./contentIds";
import type {
  ArenaGeometry,
  ArenaState,
  Vec2,
} from "./types";

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
