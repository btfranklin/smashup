import { describe, expect, it } from "vitest";

import {
  createArena,
  DEFAULT_ARENA_GEOMETRY,
  materializeArenaPoint,
} from "../src/game/arena";

describe("arena geometry", () => {
  it("materializes the authored layouts at the default dimensions", () => {
    expect(createArena("classic").mudZones).toEqual([]);
    expect(createArena("classic").objects).toEqual([]);

    const mudZones = createArena("mud_pit").mudZones;
    expect(mudZones).toHaveLength(3);
    expect(mudZones[0]).toMatchObject({
      id: 1,
      grip: 0.68,
    });
    expect(mudZones[0].x).toBeCloseTo(420);
    expect(mudZones[0].y).toBeCloseTo(250);
    expect(mudZones[0].width).toBeCloseTo(320);
    expect(mudZones[0].height).toBeCloseTo(180);

    const objects = createArena("junkyard").objects;
    expect(objects).toHaveLength(6);
    expect(objects[0]).toMatchObject({
      id: 1,
      kind: "junk",
      mass: 240,
      vx: 0,
      vy: 0,
    });
    expect(objects[0].x).toBeCloseTo(560);
    expect(objects[0].y).toBeCloseTo(250);
    expect(objects[0].radius).toBeCloseTo(26);
  });

  it("keeps materialized content inside alternate arena dimensions", () => {
    const geometry = { width: 600, height: 400, wallPadding: 54 };

    for (const variant of ["classic", "mud_pit", "junkyard"] as const) {
      const arena = createArena(variant, geometry);
      expect(arena).toMatchObject(geometry);
      for (const zone of arena.mudZones) {
        expect(zone.x).toBeGreaterThanOrEqual(geometry.wallPadding);
        expect(zone.y).toBeGreaterThanOrEqual(geometry.wallPadding);
        expect(zone.x + zone.width).toBeLessThanOrEqual(
          geometry.width - geometry.wallPadding,
        );
        expect(zone.y + zone.height).toBeLessThanOrEqual(
          geometry.height - geometry.wallPadding,
        );
      }
      for (const object of arena.objects) {
        expect(object.x - object.radius).toBeGreaterThanOrEqual(
          geometry.wallPadding,
        );
        expect(object.y - object.radius).toBeGreaterThanOrEqual(
          geometry.wallPadding,
        );
        expect(object.x + object.radius).toBeLessThanOrEqual(
          geometry.width - geometry.wallPadding,
        );
        expect(object.y + object.radius).toBeLessThanOrEqual(
          geometry.height - geometry.wallPadding,
        );
      }
    }
  });

  it("materializes lineup points from the supplied geometry", () => {
    expect(
      materializeArenaPoint(DEFAULT_ARENA_GEOMETRY, 0.5, 0.25),
    ).toEqual({ x: 750, y: 252 });
  });

  it("rejects geometry without a playable rectangle", () => {
    expect(() =>
      createArena("classic", {
        width: 100,
        height: 200,
        wallPadding: 50,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createArena("classic", {
        width: 200,
        height: 100,
        wallPadding: 50,
      }),
    ).toThrow(RangeError);
  });
});
