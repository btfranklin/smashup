import { describe, expect, it } from "vitest";

import { updateAi } from "../src/game/ai";
import { createCarFixture } from "./helpers/fixtures";

const ARENA_WIDTH = 1500;
const ARENA_HEIGHT = 900;
const WALL_PADDING = 54;

describe("AI behavior", () => {
  it("idles disabled cars", () => {
    const car = createCarFixture({
      disabled: true,
      controls: { steer: 1, forward: 1, reverse: 1 },
    });

    updateAi(car, [car], ARENA_WIDTH, ARENA_HEIGHT, WALL_PADDING, 1 / 60);

    expect(car.controls).toEqual({ steer: 0, forward: 0, reverse: 0 });
  });

  it("prefers exposed and wounded targets", () => {
    const hunter = createCarFixture({
      id: 1,
      x: 700,
      y: 450,
      angle: 0,
      aiArchetype: "scavenger",
    });
    const healthy = createCarFixture({
      id: 2,
      x: 520,
      y: 450,
      angle: Math.PI,
      systems: {
        engine: 1,
        radiator: 1,
        transmission: 1,
        steering: 1,
        overheat: 0,
      },
    });
    const wounded = createCarFixture({
      id: 3,
      x: 540,
      y: 470,
      angle: Math.PI,
      systems: {
        engine: 0.3,
        radiator: 0.3,
        transmission: 0.4,
        steering: 0.6,
        overheat: 0,
      },
    });

    updateAi(
      hunter,
      [hunter, healthy, wounded],
      ARENA_WIDTH,
      ARENA_HEIGHT,
      WALL_PADDING,
      1 / 60,
    );

    expect(hunter.aiState.targetId).toBe(wounded.id);
  });

  it("defaults to reverse-oriented pursuit when engaging a target", () => {
    const hunter = createCarFixture({
      id: 10,
      x: 700,
      y: 450,
      angle: 0,
    });
    const target = createCarFixture({
      id: 11,
      x: 520,
      y: 450,
    });

    updateAi(
      hunter,
      [hunter, target],
      ARENA_WIDTH,
      ARENA_HEIGHT,
      WALL_PADDING,
      1 / 60,
    );

    expect(hunter.aiState.targetId).toBe(target.id);
    expect(hunter.controls.forward).toBe(0);
    expect(hunter.controls.reverse).toBeGreaterThan(0.5);
  });

  it("switches into an escape behavior near dangerous boundaries", () => {
    const car = createCarFixture({
      x: 70,
      y: 70,
      angle: Math.PI,
      vx: 0,
      vy: 0,
      aiArchetype: "panic_driver",
    });
    const rival = createCarFixture({ x: 120, y: 110 });

    updateAi(
      car,
      [car, rival],
      ARENA_WIDTH,
      ARENA_HEIGHT,
      WALL_PADDING,
      0.5,
    );

    expect(car.aiState.resetTimer).toBeGreaterThan(0);
    expect(car.controls.forward + car.controls.reverse).toBeGreaterThan(0);
  });

  it("accumulates jam pressure when cornered or stalled", () => {
    const car = createCarFixture({
      x: WALL_PADDING + 25,
      y: ARENA_HEIGHT * 0.5,
      angle: 0,
      vx: 0,
      vy: 0,
    });
    const rivalA = createCarFixture({ x: car.x + 40, y: car.y });
    const rivalB = createCarFixture({ x: car.x + 20, y: car.y + 40 });

    updateAi(
      car,
      [car, rivalA, rivalB],
      ARENA_WIDTH,
      ARENA_HEIGHT,
      WALL_PADDING,
      0.45,
    );

    expect(car.aiState.jamTimer + car.aiState.resetTimer).toBeGreaterThan(0);
  });

  it("falls back toward pack center when no active target exists", () => {
    const car = createCarFixture({
      id: 20,
      x: 220,
      y: 450,
      angle: 0,
    });
    const disabledObstacle = createCarFixture({
      id: 21,
      x: 300,
      y: 500,
      disabled: true,
    });

    updateAi(
      car,
      [car, disabledObstacle],
      ARENA_WIDTH,
      ARENA_HEIGHT,
      WALL_PADDING,
      1 / 60,
    );

    expect(car.aiState.targetId).toBeNull();
    expect(car.controls.reverse).toBeGreaterThan(0.5);
    expect(car.controls.steer).toBeLessThanOrEqual(0);
  });
});
