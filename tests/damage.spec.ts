import { describe, expect, it } from "vitest";

import {
  applyImpactDamage,
  getCarSystemPhases,
  getEngineHealth,
  getKnockoutCause,
  getLocalImpact,
  getSystemPhase,
  getThermalTuningForModifier,
  getTotalBodyDamage,
  impactZoneForPoint,
  updateSubsystemWear,
} from "../src/game/damage";
import { createCarFixture } from "./helpers/fixtures";

describe("damage model", () => {
  it("resolves local impact coordinates and zones", () => {
    const car = createCarFixture({ x: 100, y: 100, angle: 0 });
    expect(getLocalImpact(car, { x: 150, y: 100 })).toMatchObject({
      forward: 50,
      side: 0,
    });
    expect(impactZoneForPoint(car, { x: 150, y: 100 })).toBe("front");
    expect(impactZoneForPoint(car, { x: 50, y: 100 })).toBe("rear");
    expect(impactZoneForPoint(car, { x: 100, y: 40 })).toBe("left");
    expect(impactZoneForPoint(car, { x: 100, y: 160 })).toBe("right");
  });

  it("maps system health to phases", () => {
    expect(getSystemPhase(0.9)).toBe("healthy");
    expect(getSystemPhase(0.7)).toBe("wounded");
    expect(getSystemPhase(0.4)).toBe("failing");
    expect(getSystemPhase(0.1)).toBe("critical");
  });

  it("derives aggregate health and visible system phases from overall condition", () => {
    const healthier = createCarFixture({
      systems: {
        engine: 0.7,
        radiator: 0.75,
        transmission: 0.8,
        steering: 0.85,
        overheat: 0,
      },
      body: { front: 0.05, rear: 0.1, left: 0.02, right: 0.08 },
    });
    const rough = createCarFixture({
      systems: {
        engine: 0.4,
        radiator: 0.5,
        transmission: 0.6,
        steering: 0.7,
        overheat: 0,
      },
      body: { front: 0.2, rear: 0.3, left: 0.1, right: 0.4 },
    });

    expect(getEngineHealth(rough)).toBeLessThan(getEngineHealth(healthier));
    expect(getTotalBodyDamage(rough)).toBeGreaterThan(
      getTotalBodyDamage(healthier),
    );
    expect(getCarSystemPhases(rough)).toEqual({
      engine: "failing",
      radiator: "failing",
      transmission: "wounded",
      steering: "wounded",
    });
  });

  it("applies front impacts, breaks lights, and can disable catastrophic nose hits", () => {
    const car = createCarFixture({
      systems: {
        engine: 0.45,
        radiator: 0.45,
        transmission: 0.6,
        steering: 0.6,
        overheat: 0,
      },
      body: { front: 0.22, rear: 0, left: 0, right: 0 },
    });

    applyImpactDamage(
      car,
      { x: car.x + car.length * 0.5, y: car.y - car.width * 0.2 },
      1,
      { x: -1, y: 0 },
    );

    expect(car.body.front).toBeGreaterThan(0.22);
    expect(car.lights.frontLeft).toBe(false);
    expect(car.disabled).toBe(true);
    expect(getKnockoutCause(car)).toBe("catastrophic_front_hit");
  });

  it("applies rear and side impacts without front-end drivetrain collapse", () => {
    const rearHit = createCarFixture();
    applyImpactDamage(
      rearHit,
      { x: rearHit.x - rearHit.length * 0.5, y: rearHit.y + rearHit.width * 0.2 },
      0.9,
      { x: 1, y: 0 },
    );
    expect(rearHit.body.rear).toBeGreaterThan(0);
    expect(rearHit.systems.engine).toBeCloseTo(1, 2);
    expect(rearHit.lights.rearRight).toBe(false);

    const sideHit = createCarFixture();
    applyImpactDamage(
      sideHit,
      { x: sideHit.x, y: sideHit.y - sideHit.width * 0.5 },
      0.8,
      { x: 0, y: 1 },
    );
    expect(sideHit.body.left).toBeGreaterThan(0);
    expect(sideHit.systems.steering).toBeLessThan(1);
    expect(sideHit.disabled).toBe(false);
  });

  it("disables cars when knockout causes are reached in precedence order", () => {
    const fire = createCarFixture({
      systems: {
        engine: 0.9,
        radiator: 0.9,
        transmission: 0.9,
        steering: 0.9,
        overheat: 1,
      },
    });
    expect(getKnockoutCause(fire)).toBe("engine_fire");

    const engineFail = createCarFixture({
      systems: {
        engine: 0.05,
        radiator: 0.6,
        transmission: 0.6,
        steering: 0.6,
        overheat: 0,
      },
    });
    expect(getKnockoutCause(engineFail)).toBe("engine_failure");

    const radiatorFail = createCarFixture({
      systems: {
        engine: 0.12,
        radiator: 0.02,
        transmission: 0.1,
        steering: 0.1,
        overheat: 0,
      },
    });
    expect(getKnockoutCause(radiatorFail)).toBe("radiator_failure");

    const collapse = createCarFixture({
      systems: {
        engine: 0.26,
        radiator: 0.22,
        transmission: 0.18,
        steering: 0.18,
        overheat: 0,
      },
      body: { front: 0.19, rear: 0.5, left: 0.44, right: 0.44 },
    });
    expect(getKnockoutCause(collapse)).toBe("body_collapse");
  });

  it("keeps hot engines hotter than normal rounds and enforces a starting floor", () => {
    const normalCar = createCarFixture({
      controls: { steer: 0, forward: 0, reverse: 0 },
      systems: {
        engine: 1,
        radiator: 1,
        transmission: 1,
        steering: 1,
        overheat: 0,
      },
    });
    const hotCar = createCarFixture({
      controls: { steer: 0, forward: 0, reverse: 0 },
      systems: {
        engine: 1,
        radiator: 1,
        transmission: 1,
        steering: 1,
        overheat: 0,
      },
    });

    expect(getThermalTuningForModifier("none").startingHeatFloor).toBe(0);
    expect(
      getThermalTuningForModifier("hot_engines").startingHeatFloor,
    ).toBeGreaterThan(0);

    updateSubsystemWear(normalCar, 1, "none");
    updateSubsystemWear(hotCar, 1, "hot_engines");

    expect(normalCar.systems.overheat).toBeLessThan(hotCar.systems.overheat);
    expect(hotCar.systems.overheat).toBeGreaterThanOrEqual(0.38);
  });

  it("pushes a damaged radiator to terminal overheat under throttle", () => {
    const car = createCarFixture({
      controls: { steer: 0, forward: 1, reverse: 0 },
      systems: {
        engine: 0.6,
        radiator: 0.02,
        transmission: 0.7,
        steering: 0.7,
        overheat: 0.75,
      },
    });

    updateSubsystemWear(car, 3.5, "hot_engines");

    expect(car.systems.overheat).toBe(1);
    expect(car.disabled).toBe(true);
  });

  it("does nothing to disabled cars during wear and impact updates", () => {
    const car = createCarFixture({ disabled: true });
    const before = JSON.stringify(car);

    updateSubsystemWear(car, 1, "none");
    applyImpactDamage(car, { x: car.x, y: car.y }, 1, { x: 1, y: 0 });

    expect(JSON.stringify(car)).toBe(before);
  });
});
