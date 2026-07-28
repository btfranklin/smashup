import { describe, expect, it } from "vitest";

import { createDefaultPlayerBuild } from "../src/game/content";
import { createFreshFrame } from "../src/game/deformation";
import {
  applyBuildUpgrade,
  serviceCondition,
  towConditionToRunnableMinimum,
} from "../src/game/upgrades";
import type { CarCondition } from "../src/game/types";

function damagedCondition(): CarCondition {
  const frame = createFreshFrame(92, 56);
  frame.vertices[0].x -= 12;
  frame.crush.front = 0.45;
  frame.scars.push({
    id: 1,
    x: 42,
    y: -8,
    angle: 0.2,
    length: 18,
    depth: 0.7,
    width: 3,
  });
  frame.nextScarId = 2;
  return {
    systems: {
      engine: 0.4,
      radiator: 0.35,
      transmission: 0.5,
      steering: 0.45,
      overheat: 0.7,
    },
    body: {
      front: 0.4,
      rear: 0.3,
      left: 0.2,
      right: 0.25,
    },
    lights: {
      frontLeft: false,
      frontRight: false,
      rearLeft: false,
      rearRight: false,
    },
    frame,
  };
}

describe("upgrade mechanics", () => {
  it("applies build bonuses for each session upgrade", () => {
    const build = createDefaultPlayerBuild("bulldozer");

    applyBuildUpgrade(build, "pit_patch");
    expect(build.coolingBonus).toBeCloseTo(0.05);
    expect(build.repairsUsed).toBe(1);

    applyBuildUpgrade(build, "ram_rig");
    expect(build.reverseForceBonus).toBe(12000);
    expect(build.forwardSpeedBonus).toBe(8);
    expect(build.frontArmorBonus).toBeCloseTo(0.08);

    applyBuildUpgrade(build, "steering_clinic");
    expect(build.steeringBonus).toBeCloseTo(0.12);
    expect(build.frontArmorBonus).toBeCloseTo(0.12);
  });

  it("services condition without mutating the previous round condition", () => {
    const condition = damagedCondition();
    const serviced = serviceCondition(condition, "pit_patch");

    expect(condition.systems.engine).toBe(0.4);
    expect(condition.body.front).toBe(0.4);
    expect(condition.lights.frontLeft).toBe(false);
    expect(condition.frame?.crush.front).toBeCloseTo(0.45);

    expect(serviced.systems.engine).toBeCloseTo(0.66);
    expect(serviced.systems.radiator).toBeCloseTo(0.65);
    expect(serviced.systems.transmission).toBeCloseTo(0.72);
    expect(serviced.systems.steering).toBeCloseTo(0.53);
    expect(serviced.systems.overheat).toBeCloseTo(0.45);
    expect(serviced.body.front).toBeCloseTo(0.2);
    expect(serviced.body.rear).toBeCloseTo(0.24);
    expect(serviced.body.left).toBeCloseTo(0.04);
    expect(serviced.body.right).toBeCloseTo(0.09);
    expect(serviced.lights).toEqual({
      frontLeft: true,
      frontRight: true,
      rearLeft: true,
      rearRight: true,
    });
    expect(serviced.frame?.crush.front).toBeLessThan(0.45);
    expect(serviced.frame?.vertices[0].x).toBeGreaterThan(
      condition.frame?.vertices[0].x ?? -Infinity,
    );
  });

  it("applies service differences for drivetrain and steering upgrades", () => {
    const ramRig = serviceCondition(damagedCondition(), "ram_rig");
    expect(ramRig.systems.engine).toBeCloseTo(0.56);
    expect(ramRig.systems.transmission).toBeCloseTo(0.7);
    expect(ramRig.body.front).toBeCloseTo(0.26);
    expect(ramRig.lights.frontLeft).toBe(false);

    const steeringClinic = serviceCondition(
      damagedCondition(),
      "steering_clinic",
    );
    expect(steeringClinic.systems.steering).toBeCloseTo(0.77);
    expect(steeringClinic.systems.transmission).toBeCloseTo(0.66);
    expect(steeringClinic.body.left).toBeCloseTo(0.04);
    expect(steeringClinic.body.right).toBeCloseTo(0.09);
  });

  it("tows a wreck back to a runnable minimum without repairing the body", () => {
    const condition = damagedCondition();
    condition.systems.engine = 0.04;
    condition.systems.radiator = 0.18;
    condition.systems.transmission = 0.31;
    condition.systems.steering = 0.08;
    condition.systems.overheat = 0.96;

    const towed = towConditionToRunnableMinimum(condition);

    expect(towed.systems).toEqual({
      engine: 0.46,
      radiator: 0.32,
      transmission: 0.32,
      steering: 0.32,
      overheat: 0.7,
    });
    expect(towed.body).toEqual(condition.body);
    expect(towed.frame).not.toBe(condition.frame);
    expect(condition.systems.engine).toBe(0.04);
  });
});
