import { describe, expect, it } from "vitest";

import { CAR_PRESETS, createDefaultPlayerBuild } from "../src/game/content";
import { createFreshCondition } from "../src/game/conditions";
import { createFreshFrame } from "../src/game/deformation";
import {
  createCarPreviewCar,
  createMenuPreviewCars,
  createRoundCars,
} from "../src/game/roster";

describe("roster and car construction", () => {
  it("creates stable menu preview lineups with the player and AI roster", () => {
    const cars = createMenuPreviewCars();

    expect(cars).toHaveLength(8);
    expect(cars[0]).toMatchObject({
      id: 0,
      label: "Player",
      isPlayer: true,
      team: "left",
      presetId: "bulldozer",
      x: 220,
      y: 355,
      angle: Math.PI,
      disabled: false,
    });
    expect(cars.slice(1).map((car) => car.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(cars.slice(1).map((car) => car.label)).toEqual([
      "Rimshot",
      "Rustline",
      "Sidewind",
      "Backlash",
      "Gravelord",
      "Tarnish",
      "Mudlark",
    ]);
    expect(cars.filter((car) => car.isPlayer)).toHaveLength(1);
  });

  it("materializes every lineup inside alternate arena dimensions", () => {
    const geometry = { width: 600, height: 400, wallPadding: 54 };
    const cars = createMenuPreviewCars(geometry);

    for (const car of cars) {
      const halfLength = car.length * 0.5;
      const halfWidth = car.width * 0.5;
      const xExtent =
        Math.abs(Math.cos(car.angle)) * halfLength +
        Math.abs(Math.sin(car.angle)) * halfWidth;
      const yExtent =
        Math.abs(Math.sin(car.angle)) * halfLength +
        Math.abs(Math.cos(car.angle)) * halfWidth;
      expect(car.x - xExtent).toBeGreaterThanOrEqual(geometry.wallPadding);
      expect(car.x + xExtent).toBeLessThanOrEqual(
        geometry.width - geometry.wallPadding,
      );
      expect(car.y - yExtent).toBeGreaterThanOrEqual(geometry.wallPadding);
      expect(car.y + yExtent).toBeLessThanOrEqual(
        geometry.height - geometry.wallPadding,
      );
    }
  });

  it("rejects arena geometry too small for the lineup", () => {
    expect(() =>
      createMenuPreviewCars({
        width: 100,
        height: 100,
        wallPadding: 49,
      }),
    ).toThrow(RangeError);
  });

  it("builds round cars from the player build while cloning condition state", () => {
    const build = createDefaultPlayerBuild("backstab");
    build.reverseForceBonus = 12000;
    build.forwardSpeedBonus = 8;
    build.steeringBonus = 0.12;
    build.frontArmorBonus = 0.08;
    build.coolingBonus = 0.05;
    const condition = createFreshCondition();
    condition.systems.radiator = 0.4;
    condition.body.front = 0.3;
    condition.lights.frontLeft = false;

    const cars = createRoundCars(build, condition);
    const player = cars[0];
    const preset = CAR_PRESETS.backstab;

    expect(cars).toHaveLength(8);
    expect(player.presetId).toBe("backstab");
    expect(player.reverseForce).toBe(preset.reverseForce + 12000);
    expect(player.engineForce).toBe(preset.engineForce + 2160);
    expect(player.forwardMaxSpeed).toBe(preset.forwardMaxSpeed + 8);
    expect(player.steeringSharpness).toBeCloseTo(
      preset.steeringSharpness + 0.12,
    );
    expect(player.frontArmor).toBeCloseTo(preset.frontArmor + 0.08);
    expect(player.systems.radiator).toBeCloseTo(0.45);
    expect(player.body.front).toBeCloseTo(0.3);
    expect(player.lights.frontLeft).toBe(false);

    player.systems.radiator = 0;
    player.body.front = 1;
    player.lights.frontLeft = true;
    expect(condition.systems.radiator).toBe(0.4);
    expect(condition.body.front).toBe(0.3);
    expect(condition.lights.frontLeft).toBe(false);
  });

  it("carries persisted frame state without reseeding synthetic body damage", () => {
    const build = createDefaultPlayerBuild("bulldozer");
    const condition = createFreshCondition();
    condition.body.front = 0.5;
    condition.frame = createFreshFrame(
      CAR_PRESETS.bulldozer.length,
      CAR_PRESETS.bulldozer.width,
    );
    condition.frame.crush.front = 0.12;
    condition.frame.vertices[0].x -= 6;

    const player = createRoundCars(build, condition)[0];

    expect(player.frame).not.toBe(condition.frame);
    expect(player.frame.crush.front).toBeCloseTo(0.12);
    expect(player.frame.vertices[0].x).toBeCloseTo(
      condition.frame.vertices[0].x,
    );
  });

  it("creates car preview cars from preset labels, condition, and disabled state", () => {
    const condition = createFreshCondition();
    condition.systems.engine = 0.2;
    condition.body.rear = 0.55;
    condition.lights.rearRight = false;

    const car = createCarPreviewCar("darter", condition, true);

    expect(car).toMatchObject({
      id: 0,
      label: "Darter",
      isPlayer: true,
      presetId: "darter",
      x: 450,
      y: 360,
      angle: 0,
      disabled: true,
    });
    expect(car.systems.engine).toBe(0.2);
    expect(car.body.rear).toBe(0.55);
    expect(car.lights.rearRight).toBe(false);

    car.body.rear = 1;
    expect(condition.body.rear).toBe(0.55);
  });
});
