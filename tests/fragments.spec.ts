import { describe, expect, it } from "vitest";

import {
  getRecentFragmentSummary,
  pushCarFragments,
  spawnCarFragments,
  updateCarFragments,
} from "../src/game/fragments";
import {
  createCarFixture,
  createCollisionFixture,
  createStateFixture,
} from "./helpers/fixtures";

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
    expect(car.vx).toBe(120);
    expect(car.systems.engine).toBe(1);
  });
});
