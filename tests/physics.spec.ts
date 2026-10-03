import { describe, expect, it } from "vitest";

import {
  resolveArenaObjectInteractions,
  resolveCarCollisions,
  stepArenaObjects,
  stepCar,
} from "../src/game/physics";
import { CAR_PRESETS } from "../src/game/content";
import { applyFrameImpact } from "../src/game/deformation";
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

  it.each([-1, 1])("removes powered drive from a disabled car at input %f", (driveInput) => {
    const state = createStateFixture();
    const car = createCarFixture({
      disabled: true,
      driveInput,
      controls: { steer: 1, forward: 1, reverse: 1 },
    });

    stepCar(car, 1 / 60, state.arena, "none");

    expect(car.vx).toBe(0);
    expect(car.vy).toBe(0);
    expect(car.driveInput).toBe(0);
    expect(car.controls).toEqual({ steer: 0, forward: 0, reverse: 0 });

    car.vx = 60;
    car.vy = 12;
    stepCar(car, 1 / 60, state.arena, "none");

    expect(car.vx).toBeGreaterThan(0);
    expect(car.vx).toBeLessThan(60);
    expect(car.vy).toBeGreaterThan(0);
    expect(car.x).toBeGreaterThan(500);
  });

  it("removes powered drive in the step that overheating disables a car", () => {
    const state = createStateFixture();
    const car = createCarFixture({
      driveInput: 1,
      controls: { steer: 0, forward: 1, reverse: 0 },
    });
    car.systems.overheat = 1;

    stepCar(car, 1 / 60, state.arena, "hot_engines");

    expect(car.disabled).toBe(true);
    expect(car.driveInput).toBe(0);
    expect(car.vx).toBe(0);
    expect(car.vy).toBe(0);
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

  it.each(Object.values(CAR_PRESETS))("retains more lateral speed in mud for $title", ({ id }) => {
    const state = createStateFixture();
    const dryArena = { ...state.arena, mudZones: [] };
    const mudArena = {
      ...dryArena,
      mudZones: [{ id: 1, x: 400, y: 400, width: 200, height: 200, grip: 0.5 }],
    };
    const dry = createCarFixture({ vx: 20, vy: 90 }, id);
    const muddy = createCarFixture({ vx: 20, vy: 90 }, id);

    stepCar(dry, 1 / 60, dryArena, "none");
    stepCar(muddy, 1 / 60, mudArena, "none");

    expect(muddy.vy).toBeGreaterThan(dry.vy);
    expect(muddy.vy).toBeLessThan(90);
  });

  it.each(["steering", "traction"] as const)("retains more lateral speed with lower %s grip", (source) => {
    const state = createStateFixture();
    const arena = { ...state.arena, mudZones: [] };
    const healthy = createCarFixture({ vy: 90 });
    const lowGrip = createCarFixture({ vy: 90 });
    if (source === "steering") {
      lowGrip.systems.steering = 0.4;
    } else {
      lowGrip.tractionBias *= 0.5;
    }

    stepCar(healthy, 1 / 60, arena, "none");
    stepCar(lowGrip, 1 / 60, arena, "none");

    expect(lowGrip.vy).toBeGreaterThan(healthy.vy);
    expect(lowGrip.vy).toBeLessThan(90);
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
    "contains a rotated %s car at angle %f by its live frame extents",
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

      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const rotatedVertices = car.frame.vertices.map((vertex) => ({
        x: vertex.x * cosine - vertex.y * sine,
        y: vertex.x * sine + vertex.y * cosine,
      }));
      const expectedX = state.arena.wallPadding - Math.min(
        ...rotatedVertices.map((vertex) => vertex.x),
      );
      const expectedY = state.arena.wallPadding - Math.min(
        ...rotatedVertices.map((vertex) => vertex.y),
      );
      expect(car.x).toBeCloseTo(expectedX);
      expect(car.y).toBeCloseTo(expectedY);
    },
  );

  it("lets a crushed end settle closer to the arena wall", () => {
    const state = createStateFixture();
    const car = createCarFixture({ x: 0, y: 300 });
    for (let index = 0; index < 16; index += 1) {
      applyFrameImpact(
        car,
        { x: -car.length * 0.5, y: 0 },
        1,
        "rear",
        { x: 1, y: 0 },
      );
    }

    stepCar(car, 0, state.arena, "none");

    const rearEdge = Math.min(
      ...car.frame.vertices.map((vertex) => vertex.x),
    );
    expect(car.x).toBeLessThan(
      state.arena.wallPadding + car.length * 0.5,
    );
    expect(car.x + rearEdge).toBeCloseTo(state.arena.wallPadding);
  });

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

  it("ignores loose objects that touch only an empty rectangular corner", () => {
    const state = createStateFixture();
    const car = createCarFixture({ x: 500, y: 500 });
    const object = {
      id: 4,
      kind: "junk" as const,
      x: car.x + car.length * 0.5 + 1,
      y: car.y + car.width * 0.5 + 1,
      vx: 0,
      vy: 0,
      radius: 4,
      mass: 40,
      rotation: 0,
      spin: 0,
    };
    const initialCar = { x: car.x, y: car.y };
    const initialObject = { x: object.x, y: object.y };

    resolveArenaObjectInteractions([car], [object], state.arena);

    expect({ x: car.x, y: car.y }).toEqual(initialCar);
    expect({ x: object.x, y: object.y }).toEqual(initialObject);
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
    expect(object.y).toBeGreaterThan(car.y);
    expect(Math.abs(object.x - car.x)).toBeLessThan(2);
    expect(Math.hypot(object.x - car.x, object.y - car.y)).toBeLessThan(
      car.width * 0.5 + object.radius,
    );
  });

  it("ignores overlap that exists only in pristine rectangular corner bounds", () => {
    const first = createCarFixture({
      id: 41,
      x: 500,
      y: 500,
      vx: 100,
      vy: 100,
    });
    const second = createCarFixture({
      id: 42,
      x: 585,
      y: 550,
    });
    const initialPositions = {
      first: { x: first.x, y: first.y },
      second: { x: second.x, y: second.y },
    };

    const collisions = resolveCarCollisions([first, second]);

    expect(collisions).toEqual([]);
    expect({ x: first.x, y: first.y }).toEqual(initialPositions.first);
    expect({ x: second.x, y: second.y }).toEqual(initialPositions.second);
  });

  it("flattens shallow concave frame portions for collision purposes", () => {
    const striker = createCarFixture({
      id: 43,
      x: 500,
      y: 500,
      vx: 40,
    });
    const target = createCarFixture({
      id: 44,
      x: 590.5,
      y: 500,
    });
    const strikerFront = Math.max(
      ...striker.frame.vertices.map((vertex) => vertex.x),
    );
    const targetRearTips = target.frame.vertices.filter((vertex) =>
      vertex.id.startsWith("rear-tip"),
    );
    const visibleCenterGap =
      target.x +
      Math.min(...targetRearTips.map((vertex) => vertex.x)) -
      (striker.x + strikerFront);

    const collisions = resolveCarCollisions([striker, target]);

    expect(visibleCenterGap).toBeGreaterThan(0);
    expect(collisions).toHaveLength(1);
  });

  it("uses crushed frame extents instead of the original car rectangle", () => {
    const first = createCarFixture({
      id: 45,
      x: 500,
      y: 500,
      vx: 120,
    });
    const second = createCarFixture({
      id: 46,
      x: 580,
      y: 500,
    });
    for (let index = 0; index < 16; index += 1) {
      applyFrameImpact(
        first,
        { x: first.length * 0.5, y: 0 },
        1,
        "front",
        { x: -1, y: 0 },
      );
      applyFrameImpact(
        second,
        { x: -second.length * 0.5, y: 0 },
        1,
        "rear",
        { x: 1, y: 0 },
      );
    }
    const firstFront = Math.max(
      ...first.frame.vertices.map((vertex) => vertex.x),
    );
    const secondRear = Math.min(
      ...second.frame.vertices.map((vertex) => vertex.x),
    );
    const visibleGap = second.x + secondRear - (first.x + firstFront);
    const initialFirstX = first.x;
    const initialSecondX = second.x;

    const collisions = resolveCarCollisions([first, second]);

    expect(visibleGap).toBeGreaterThan(20);
    expect(collisions).toEqual([]);
    expect(first.x).toBe(initialFirstX);
    expect(second.x).toBe(initialSecondX);
  });

  it("refreshes a deformed hull before later contacts in the same pileup", () => {
    const first = createCarFixture({
      id: 47,
      x: 500,
      y: 500,
      vx: 220,
    });
    const headOnTarget = createCarFixture({
      id: 48,
      x: 555,
      y: 500,
      angle: Math.PI,
    });
    const nearbyTarget = createCarFixture({
      id: 49,
      x: 570,
      y: 500,
    });
    const originalFront = Math.max(
      ...first.frame.vertices.map((vertex) => vertex.x),
    );

    const collisions = resolveCarCollisions([
      first,
      headOnTarget,
      nearbyTarget,
    ]);

    expect(collisions).toContainEqual(
      expect.objectContaining({ aId: first.id, bId: headOnTarget.id }),
    );
    expect(collisions).not.toContainEqual(
      expect.objectContaining({ aId: first.id, bId: nearbyTarget.id }),
    );
    expect(
      Math.max(...first.frame.vertices.map((vertex) => vertex.x)),
    ).toBeLessThan(originalFront);
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
