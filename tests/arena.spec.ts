import { describe, expect, it } from "vitest";

import {
  createArena,
  DEFAULT_ARENA_GEOMETRY,
  getArenaObjectOutline,
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

  it("shares the junk outline across movement and updates it when size changes", () => {
    const object = createArena("junkyard").objects[0];
    const original = getArenaObjectOutline(object);
    expect(original).not.toBeNull();
    expect(Math.max(...original!.map((point) => point.x))).toBeCloseTo(
      object.radius * 1.2,
    );
    expect(Math.max(...original!.map((point) => point.y))).toBeCloseTo(
      object.radius * 0.8,
    );

    object.x += 100;
    object.rotation = Math.PI / 2;
    expect(getArenaObjectOutline(object)).toBe(original);

    object.radius = 2;
    const smaller = getArenaObjectOutline(object);
    expect(smaller).not.toBe(original);
    for (const point of smaller!) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(object.radius * 1.2 + 1e-8);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(object.radius * 0.8 + 1e-8);
    }
    object.kind = "tire";
    expect(getArenaObjectOutline(object)).toBeNull();
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
