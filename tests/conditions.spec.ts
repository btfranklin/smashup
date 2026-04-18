import { describe, expect, it } from "vitest";

import {
  captureCarCondition,
  cloneCondition,
  createFreshCondition,
} from "../src/game/conditions";
import { createCarFixture } from "./helpers/fixtures";

describe("condition helpers", () => {
  it("creates fresh conditions with intact systems, body, and lights", () => {
    expect(createFreshCondition()).toEqual({
      systems: {
        engine: 1,
        radiator: 1,
        transmission: 1,
        steering: 1,
        overheat: 0,
      },
      body: {
        front: 0,
        rear: 0,
        left: 0,
        right: 0,
      },
      lights: {
        frontLeft: true,
        frontRight: true,
        rearLeft: true,
        rearRight: true,
      },
    });
  });

  it("clones without sharing nested mutable state", () => {
    const original = createFreshCondition();
    const copy = cloneCondition(original);
    copy.systems.engine = 0.4;
    copy.body.front = 0.3;
    copy.lights.frontLeft = false;

    expect(original.systems.engine).toBe(1);
    expect(original.body.front).toBe(0);
    expect(original.lights.frontLeft).toBe(true);
  });

  it("captures a car snapshot into a portable condition object", () => {
    const car = createCarFixture({
      systems: {
        engine: 0.3,
        radiator: 0.6,
        transmission: 0.7,
        steering: 0.8,
        overheat: 0.5,
      },
      body: { front: 0.4, rear: 0.2, left: 0.1, right: 0.3 },
      lights: {
        frontLeft: false,
        frontRight: true,
        rearLeft: false,
        rearRight: true,
      },
    });

    expect(captureCarCondition(car)).toEqual({
      systems: car.systems,
      body: car.body,
      lights: car.lights,
    });
  });
});
