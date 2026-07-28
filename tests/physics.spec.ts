import { describe, expect, it } from "vitest";

import {
  resolveArenaObjectInteractions,
  resolveCarCollisions,
  stepArenaObjects,
  stepCar,
} from "../src/game/physics";
import { CAR_PRESETS } from "../src/game/content";
import { signedSpeedForCar } from "../src/game/math";
import { createCarFixture, createRunningState, createStateFixture } from "./helpers/fixtures";

describe("physics", () => {
  it("applies throttle, braking, and a meaningful forward speed cap", () => {
    const state = createStateFixture();
    const car = createCarFixture({
      controls: { steer: 0, forward: 1, reverse: 0 },
      angle: 0,
    });
    stepCar(car, 1 / 30, state.arena, "none");
    expect(car.vx).toBeGreaterThan(0);

    car.controls = { steer: 0, forward: 1, reverse: 1 };
    car.vx = 140;
    stepCar(car, 1 / 30, state.arena, "none");
    expect(car.vx).toBeLessThan(140);

    car.controls = { steer: 0, forward: 1, reverse: 0 };
    car.vx = car.forwardMaxSpeed * 4;
    stepCar(car, 1 / 30, state.arena, "none");
    expect(signedSpeedForCar(car)).toBeLessThan(car.forwardMaxSpeed * 4);
    expect(signedSpeedForCar(car)).toBeLessThanOrEqual(
      car.forwardMaxSpeed * 1.1,
    );
  });

  it("reduces lateral slip and tracks slip amount", () => {
    const state = createStateFixture();
    const car = createCarFixture({
      angle: 0,
      vx: 20,
      vy: 90,
      controls: { steer: 0, forward: 0, reverse: 0 },
    });

    stepCar(car, 1 / 30, state.arena, "none");

    expect(car.slipAmount).toBeGreaterThan(0);
    expect(Math.abs(car.vy)).toBeLessThan(90);
  });

  it("clamps cars against arena walls and nudges them back inward", () => {
    const state = createStateFixture();
    const car = createCarFixture({
      x: 10,
      y: 10,
      vx: -120,
      vy: -120,
    });

    stepCar(car, 1 / 30, state.arena, "none");

    expect(car.x).toBeGreaterThanOrEqual(
      state.arena.wallPadding + car.length * 0.5,
    );
    expect(car.y).toBeGreaterThanOrEqual(
      state.arena.wallPadding + car.width * 0.5,
    );
    expect(car.vx).toBeGreaterThan(0);
    expect(car.vy).toBeGreaterThan(0);
  });

  it.each(
    Object.keys(CAR_PRESETS).flatMap((presetId) =>
      [0, Math.PI / 4, Math.PI / 2].map((angle) => [presetId, angle] as const),
    ),
  )(
    "contains a rotated %s car at angle %f by its projected extents",
    (presetId, angle) => {
      const state = createStateFixture();
      const car = createCarFixture(
        {
          x: 0,
          y: 0,
          angle,
        },
        presetId as keyof typeof CAR_PRESETS,
      );

      stepCar(car, 0, state.arena, "none");

      const halfLength = car.length * 0.5;
      const halfWidth = car.width * 0.5;
      const expectedXExtent =
        Math.abs(Math.cos(angle)) * halfLength +
        Math.abs(Math.sin(angle)) * halfWidth;
      const expectedYExtent =
        Math.abs(Math.sin(angle)) * halfLength +
        Math.abs(Math.cos(angle)) * halfWidth;
      expect(car.x).toBeCloseTo(state.arena.wallPadding + expectedXExtent);
      expect(car.y).toBeCloseTo(state.arena.wallPadding + expectedYExtent);
    },
  );

  it("slows acceleration inside mud zones", () => {
    const state = createRunningState();
    const dry = createCarFixture({
      x: 300,
      y: 300,
      controls: { steer: 0, forward: 1, reverse: 0 },
    });
    const muddy = createCarFixture({
      x: 500,
      y: 300,
      controls: { steer: 0, forward: 1, reverse: 0 },
    });
    const mudZone = {
      id: 1,
      x: 420,
      y: 250,
      width: 320,
      height: 180,
      grip: 0.5,
    };

    stepCar(
      dry,
      1 / 15,
      { ...state.arena, mudZones: [] },
      "none",
    );
    stepCar(
      muddy,
      1 / 15,
      { ...state.arena, mudZones: [mudZone] },
      "none",
    );

    expect(dry.vx).toBeGreaterThan(muddy.vx);
  });

  it("moves and bounces arena objects inside wall bounds", () => {
    const state = createStateFixture();
    const object = {
      id: 1,
      kind: "tire" as const,
      x: state.arena.width - state.arena.wallPadding - 2,
      y: state.arena.height - state.arena.wallPadding - 2,
      vx: 100,
      vy: 80,
      radius: 18,
      mass: 90,
      rotation: 0,
      spin: 2,
    };

    stepArenaObjects([object], 1 / 10, state.arena);

    expect(object.x).toBeLessThanOrEqual(
      state.arena.width - state.arena.wallPadding - object.radius,
    );
    expect(object.y).toBeLessThanOrEqual(
      state.arena.height - state.arena.wallPadding - object.radius,
    );
    expect(object.vx).toBeLessThan(0);
    expect(object.vy).toBeLessThan(0);
    expect(object.rotation).not.toBe(0);
  });

  it("pushes loose objects when cars overlap them", () => {
    const state = createStateFixture();
    const car = createCarFixture({ x: 500, y: 500, vx: 90, vy: 0 });
    const object = {
      id: 1,
      kind: "junk" as const,
      x: car.x + car.length * 0.5 + 10,
      y: 500,
      vx: 0,
      vy: 0,
      radius: 20,
      mass: 240,
      rotation: 0,
      spin: 0,
    };

    resolveArenaObjectInteractions([car], [object], state.arena);

    expect(object.vx).toBeGreaterThan(0);
    expect(car.vx).toBeLessThan(90);
  });

  it("pushes an embedded object through its nearest car face", () => {
    const state = createStateFixture();
    const car = createCarFixture({ x: 500, y: 500 });
    const object = {
      id: 2,
      kind: "junk" as const,
      x: car.x + car.length * 0.5 - 5,
      y: car.y,
      vx: 0,
      vy: 0,
      radius: 20,
      mass: 240,
      rotation: 0,
      spin: 0,
    };
    const initialCarX = car.x;
    const initialObjectX = object.x;

    resolveArenaObjectInteractions([car], [object], state.arena);

    expect(car.x).toBeLessThan(initialCarX);
    expect(object.x).toBeGreaterThan(initialObjectX);
    expect(object.x - car.x).toBeCloseTo(car.length * 0.5 + object.radius);
  });

  it("uses a deterministic outward normal for an exactly centered object", () => {
    const state = createStateFixture();
    const car = createCarFixture({ x: 500, y: 500, angle: 0 });
    const object = {
      id: 3,
      kind: "tire" as const,
      x: car.x,
      y: car.y,
      vx: 0,
      vy: 0,
      radius: 18,
      mass: 90,
      rotation: 0,
      spin: 0,
    };

    resolveArenaObjectInteractions([car], [object], state.arena);

    expect(Number.isFinite(car.x)).toBe(true);
    expect(Number.isFinite(car.y)).toBe(true);
    expect(Number.isFinite(object.x)).toBe(true);
    expect(Number.isFinite(object.y)).toBe(true);
    expect(object.x).toBeCloseTo(car.x);
    expect(object.y).toBeGreaterThan(car.y);
    expect(object.y - car.y).toBeCloseTo(car.width * 0.5 + object.radius);
  });

  it("detects collisions, separates cars, and softens front-into-rear self-damage", () => {
    const striker = createCarFixture({
      id: 1,
      x: 500,
      y: 500,
      angle: 0,
      vx: 180,
      vy: 0,
      isPlayer: true,
      label: "Striker",
    });
    const target = createCarFixture({
      id: 2,
      x: 560,
      y: 500,
      angle: 0,
      vx: 0,
      vy: 0,
      label: "Target",
    });

    const collisions = resolveCarCollisions([striker, target]);

    expect(collisions).toHaveLength(1);
    expect(collisions[0].zoneA).toBe("front");
    expect(collisions[0].zoneB).toBe("rear");
    expect(collisions[0].severity).toBeGreaterThan(0);
    expect(collisions[0].aDisabledByImpact).toBe(false);
    expect(collisions[0].bDisabledByImpact).toBe(false);
    expect(striker.systems.engine).toBeGreaterThan(0.9);
    expect(target.body.rear).toBeGreaterThan(0);
  });

  it("records the exact car disabled by an impact", () => {
    const striker = createCarFixture({
      id: 31,
      x: 500,
      y: 500,
      vx: 220,
    });
    const target = createCarFixture({
      id: 32,
      x: 555,
      y: 500,
      angle: Math.PI,
      systems: {
        engine: 0.29,
        radiator: 0.29,
        transmission: 0.29,
        steering: 0.29,
        overheat: 0,
      },
      body: { front: 0.21, rear: 0, left: 0, right: 0 },
    });

    const collision = resolveCarCollisions([striker, target])[0];

    expect(target.disabled).toBe(true);
    expect(collision.aDisabledByImpact).toBe(false);
    expect(collision.bDisabledByImpact).toBe(true);
  });

  it("separates medium from extreme front-hit damage severity", () => {
    const mediumA = createCarFixture({ id: 10, x: 400, y: 500, vx: 95 });
    const mediumB = createCarFixture({ id: 11, x: 455, y: 500, vx: 0 });
    const extremeA = createCarFixture({ id: 12, x: 400, y: 620, vx: 220 });
    const extremeB = createCarFixture({ id: 13, x: 455, y: 620, vx: 0 });

    const medium = resolveCarCollisions([mediumA, mediumB])[0];
    const extreme = resolveCarCollisions([extremeA, extremeB])[0];

    expect(medium.damageSeverity).toBeGreaterThan(0);
    expect(extreme.damageSeverity).toBeGreaterThan(medium.damageSeverity);
  });

  it("records visible collisions below the gameplay damage threshold", () => {
    const striker = createCarFixture({
      id: 21,
      x: 500,
      y: 500,
      angle: 0,
      vx: 32,
      vy: 0,
    });
    const target = createCarFixture({
      id: 22,
      x: 558,
      y: 500,
      angle: 0,
      vx: 0,
      vy: 0,
    });

    const collision = resolveCarCollisions([striker, target])[0];

    expect(collision.severity).toBeGreaterThan(0);
    expect(collision.damageSeverity).toBe(0);
    expect(collision.damageTakenA).toBe(0);
    expect(collision.damageTakenB).toBe(0);
    expect(collision.aDisabledByImpact).toBe(false);
    expect(collision.bDisabledByImpact).toBe(false);
    expect(collision.deformationA).toBe(0);
    expect(collision.deformationB).toBe(0);
    expect(collision.pointA).toMatchObject({ x: expect.any(Number) });
    expect(collision.pointB).toMatchObject({ x: expect.any(Number) });
  });
});
