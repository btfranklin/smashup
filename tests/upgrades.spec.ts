import { describe, expect, it } from "vitest";

import { createDefaultPlayerBuild } from "../src/game/content";
import { applyBuildUpgrade, serviceCondition } from "../src/game/upgrades";
import type { CarCondition } from "../src/game/types";

function damagedCondition(): CarCondition {
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
});
