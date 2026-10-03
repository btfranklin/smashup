import { describe, expect, it } from "vitest";

import {
  getRecentFragmentSummary,
  pushCarFragments,
  spawnCarFragments,
  updateCarFragments,
} from "../src/game/fragments";
import { applyFrameImpact } from "../src/game/deformation";
import { getCarPolygonContact } from "../src/game/physics";
import {
  createCarFixture,
  createCollisionFixture,
  createStateFixture,
} from "./helpers/fixtures";

function hasConvexOutline(points: Array<{ x: number; y: number }>): boolean {
  let turnDirection = 0;
  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    const third = points[(index + 2) % points.length];
    const turn =
      (second.x - first.x) * (third.y - second.y) -
      (second.y - first.y) * (third.x - second.x);
    if (Math.abs(turn) < 1e-8) {
      continue;
    }
    const direction = Math.sign(turn);
    if (turnDirection !== 0 && turnDirection !== direction) {
      return false;
    }
    turnDirection = direction;
  }
  return turnDirection !== 0;
}

describe("car fragments", () => {
  it("spawns source-colored fragments in proportion to each car's own damage", () => {
    const lightDamage = createCarFixture({
      id: 1,
      x: 500,
      y: 500,
      vx: 40,
      color: "#336699",
      accent: "#99ccff",
    });
    const heavyDamage = createCarFixture({
      id: 1,
      x: 500,
      y: 500,
      vx: 40,
      color: "#336699",
      accent: "#99ccff",
    });

    const lightState = createStateFixture({
      cars: [lightDamage],
      recentCollisions: [
        createCollisionFixture({
          aId: 99,
          bId: 1,
          normal: { x: 1, y: 0 },
          damageSeverity: 0.9,
          deformationA: 0,
          damageTakenB: 0.24,
          deformationB: 0.06,
          pointB: { x: 548, y: 500 },
        }),
        createCollisionFixture({
          aId: 99,
          bId: 1,
          damageSeverity: 0.4,
          deformationB: 0.16,
        }),
      ],
    });
    const heavyState = createStateFixture({
      cars: [heavyDamage],
      recentCollisions: [
        createCollisionFixture({
          aId: 99,
          bId: 1,
          normal: { x: 1, y: 0 },
          damageSeverity: 0.9,
          deformationA: 0,
          damageTakenB: 0.9,
          deformationB: 0.16,
          pointB: { x: 548, y: 500 },
        }),
      ],
    });

    spawnCarFragments(lightState);
    spawnCarFragments(heavyState);

    expect(lightState.carFragments.length).toBeGreaterThan(0);
    expect(heavyState.carFragments.length).toBeGreaterThan(
      lightState.carFragments.length,
    );
    expect(heavyState.carFragments.length).toBeLessThanOrEqual(4);
    expect(
      heavyState.carFragments.every((fragment) => fragment.sourceCarId === 1),
    ).toBe(true);
    expect(heavyState.carFragments.some((fragment) => fragment.vx > 0)).toBe(
      true,
    );
    expect(
      heavyState.carFragments.some((fragment) => fragment.color.startsWith("rgb(")),
    ).toBe(true);
    expect(heavyState.carFragments.every((fragment) => hasConvexOutline(fragment.points))).toBe(
      true,
    );
  });

  it("keeps fragment outlines convex across many deterministic contacts", () => {
    const car = createCarFixture({ id: 1, x: 500, y: 500 });
    const state = createStateFixture({
      cars: [car],
      recentCollisions: Array.from({ length: 120 }, (_, index) => {
        const point = {
          x: 100 + index * 8,
          y: 100 + index * 3,
        };
        return createCollisionFixture({
          aId: car.id,
          bId: 2,
          point,
          pointA: point,
          damageSeverity: 1,
          damageTakenA: 1,
          damageTakenB: 0,
          deformationA: 0.2,
          deformationB: 0,
        });
      }),
    });

    spawnCarFragments(state);

    expect(state.carFragments.length).toBeGreaterThan(100);
    expect(
      state.carFragments.every((fragment) => hasConvexOutline(fragment.points)),
    ).toBe(true);
  });

  it("caps, moves, bounds, and summarizes fragments", () => {
    const car = createCarFixture({ id: 1, x: 500, y: 500 });
    const state = createStateFixture({
      cars: [car],
      recentCollisions: Array.from({ length: 36 }, (_, index) =>
        createCollisionFixture({
          aId: 1,
          bId: 99,
          pointA: { x: 548, y: 500 + index },
          normal: { x: -1, y: 0 },
          damageSeverity: 1,
          damageTakenA: 1,
          deformationA: 0.2,
          damageTakenB: 0,
          deformationB: 0,
        }),
      ),
    });

    spawnCarFragments(state);
    expect(state.carFragments.length).toBeLessThanOrEqual(220);
    expect(state.carFragments.length).toBeLessThanOrEqual(36 * 4);
    const firstX = state.carFragments[0].x;
    updateCarFragments(state, 0.2);
    expect(state.carFragments[0].x).not.toBe(firstX);
    expect(
      state.carFragments.every(
        (fragment) =>
          fragment.x >= state.arena.wallPadding + fragment.radius &&
          fragment.x <= state.arena.width - state.arena.wallPadding - fragment.radius,
      ),
    ).toBe(true);
    expect(getRecentFragmentSummary(state)).toHaveLength(6);
  });

  it("lets cars push fragments without moving or damaging the car", () => {
    const car = createCarFixture({ id: 1, x: 500, y: 500, vx: 120, vy: 0 });
    const state = createStateFixture({
      cars: [car],
      carFragments: [
        {
          id: 1,
          sourceCarId: 2,
          x: 540,
          y: 500,
          vx: 0,
          vy: 0,
          radius: 5,
          mass: 20,
          rotation: 0,
          spin: 0,
          color: "#666666",
          edgeColor: "#222222",
          points: [
            { x: -4, y: -3 },
            { x: 5, y: -2 },
            { x: 1, y: 4 },
          ],
        },
      ],
    });

    pushCarFragments(state);

    expect(state.carFragments[0].vx).toBeGreaterThan(0);
    expect(state.carFragments[0].spin).toBeGreaterThan(0);
    expect(car.vx).toBe(120);
    expect(car.systems.engine).toBe(1);
  });

  it("leaves fragments clear of a crushed nose instead of using car.length", () => {
    const car = createCarFixture({ id: 1, x: 500, y: 500, angle: 0 });
    for (let index = 0; index < 16; index += 1) {
      applyFrameImpact(
        car,
        { x: car.length * 0.5, y: 0 },
        1,
        "front",
        { x: -1, y: 0 },
      );
    }
    const visibleFront = Math.max(
      ...car.frame.vertices.map((vertex) => vertex.x),
    );
    const fragment = {
      id: 1,
      sourceCarId: 2,
      x: car.x + visibleFront + 5,
      y: 500,
      vx: 0,
      vy: 0,
      radius: 5,
      mass: 20,
      rotation: 0,
      spin: 0,
      color: "#666666",
      edgeColor: "#222222",
      points: [
        { x: -2, y: -2 },
        { x: 4, y: 0 },
        { x: -2, y: 2 },
      ],
    };
    const state = createStateFixture({ cars: [car], carFragments: [fragment] });

    pushCarFragments(state);

    expect(fragment.x).toBe(car.x + visibleFront + 5);
  });

  it.each([
    { name: "horizontal", angle: 0, rotation: 0, x: 547, y: 500 },
    {
      name: "rotated",
      angle: Math.PI / 2,
      rotation: Math.PI / 2,
      x: 500,
      y: 547,
    },
  ])("moves visible fragment points to the car edge after $name contact", (scenario) => {
    const car = createCarFixture({
      id: 1,
      x: 500,
      y: 500,
      angle: scenario.angle,
    });
    const fragment = {
      id: 1,
      sourceCarId: 2,
      x: scenario.x,
      y: scenario.y,
      vx: 0,
      vy: 0,
      radius: 5,
      mass: 20,
      rotation: scenario.rotation,
      spin: 0,
      color: "#666666",
      edgeColor: "#222222",
      points: [
        { x: -2, y: -2 },
        { x: 4, y: 0 },
        { x: -2, y: 2 },
      ],
    };
    const state = createStateFixture({ cars: [car], carFragments: [fragment] });

    pushCarFragments(state);

    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const fragmentRear = Math.min(
      ...fragment.points.map((point) => {
        const worldX =
          fragment.x +
          point.x * Math.cos(fragment.rotation) -
          point.y * Math.sin(fragment.rotation);
        const worldY =
          fragment.y +
          point.x * Math.sin(fragment.rotation) +
          point.y * Math.cos(fragment.rotation);
        return (
          (worldX - car.x) * forward.x + (worldY - car.y) * forward.y
        );
      }),
    );
    const carFront = Math.max(...car.frame.vertices.map((vertex) => vertex.x));
    expect(fragmentRear).toBeCloseTo(carFront, 1);
  });

  it("ejects an embedded fragment through the nearest visible car edge", () => {
    const car = createCarFixture({ id: 1, x: 500, y: 500, angle: 0 });
    const fragment = {
      id: 1,
      sourceCarId: 2,
      x: car.x,
      y: car.y,
      vx: 0,
      vy: 0,
      radius: 5,
      mass: 20,
      rotation: 0,
      spin: 0,
      color: "#666666",
      edgeColor: "#222222",
      points: [
        { x: -2, y: -2 },
        { x: 4, y: 0 },
        { x: -2, y: 2 },
      ],
    };
    const state = createStateFixture({ cars: [car], carFragments: [fragment] });

    pushCarFragments(state);

    expect(Math.hypot(fragment.x - car.x, fragment.y - car.y)).toBeLessThan(40);
    expect(Math.hypot(fragment.x - car.x, fragment.y - car.y)).toBeGreaterThan(25);
    const cosine = Math.cos(fragment.rotation);
    const sine = Math.sin(fragment.rotation);
    const fragmentHull = fragment.points.map((point) => ({
      x: fragment.x + point.x * cosine - point.y * sine,
      y: fragment.y + point.x * sine + point.y * cosine,
    }));
    expect(getCarPolygonContact(car, fragmentHull)).toBeNull();
  });
});
