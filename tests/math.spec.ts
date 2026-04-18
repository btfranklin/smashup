import { describe, expect, it } from "vitest";

import {
  clamp,
  clamp01,
  normalizeAngle,
  pseudoRandom,
  signedSpeedForCar,
} from "../src/game/math";

describe("math helpers", () => {
  it("clamps values to the provided range", () => {
    expect(clamp(-4, 0, 10)).toBe(0);
    expect(clamp(14, 0, 10)).toBe(10);
    expect(clamp(6, 0, 10)).toBe(6);
  });

  it("clamp01 constrains values to the unit interval", () => {
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.2)).toBe(1);
  });

  it("normalizes angles into the -pi to pi range", () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it("computes signed speed from velocity projected onto the car heading", () => {
    expect(signedSpeedForCar({ vx: 10, vy: 0, angle: 0 })).toBeCloseTo(10);
    expect(
      signedSpeedForCar({ vx: 0, vy: -8, angle: -Math.PI / 2 }),
    ).toBeCloseTo(8);
    expect(signedSpeedForCar({ vx: -5, vy: 0, angle: 0 })).toBeCloseTo(-5);
  });

  it("produces deterministic pseudo-random values in [0, 1)", () => {
    const first = pseudoRandom(42);
    const second = pseudoRandom(42);
    const other = pseudoRandom(43);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });
});
