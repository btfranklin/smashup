import { cloneCondition } from "./conditions";
import type { SessionUpgradeId } from "./contentIds";
import { repairCarFrame } from "./deformation";
import type { CarCondition, PlayerBuild } from "./types";

export function applyBuildUpgrade(
  build: PlayerBuild,
  upgradeId: SessionUpgradeId,
): void {
  if (upgradeId === "pit_patch") {
    build.coolingBonus += 0.05;
    build.repairsUsed += 1;
  } else if (upgradeId === "ram_rig") {
    build.reverseForceBonus += 12000;
    build.forwardSpeedBonus += 8;
    build.frontArmorBonus += 0.08;
  } else if (upgradeId === "steering_clinic") {
    build.steeringBonus += 0.12;
    build.frontArmorBonus += 0.04;
  }
}

function repairSystem(
  condition: CarCondition,
  system: keyof Omit<CarCondition["systems"], "overheat">,
  amount: number,
): void {
  condition.systems[system] = Math.min(1, condition.systems[system] + amount);
}

function coolCondition(condition: CarCondition, amount: number): void {
  condition.systems.overheat = Math.max(0, condition.systems.overheat - amount);
}

function repairBody(
  condition: CarCondition,
  zone: keyof CarCondition["body"],
  amount: number,
): void {
  condition.body[zone] = Math.max(0, condition.body[zone] - amount);
}

function restoreAllLights(condition: CarCondition): void {
  condition.lights.frontLeft = true;
  condition.lights.frontRight = true;
  condition.lights.rearLeft = true;
  condition.lights.rearRight = true;
}

export function serviceCondition(
  condition: CarCondition,
  upgradeId: SessionUpgradeId,
): CarCondition {
  const next = cloneCondition(condition);
  const baselineRepair = 0.08;
  repairSystem(next, "engine", baselineRepair);
  repairSystem(next, "radiator", baselineRepair);
  repairSystem(next, "transmission", baselineRepair);
  repairSystem(next, "steering", baselineRepair);
  coolCondition(next, 0.25);
  repairBody(next, "front", 0.06);
  repairBody(next, "rear", 0.06);
  repairBody(next, "left", 0.06);
  repairBody(next, "right", 0.06);
  next.frame = repairCarFrame(next.frame, 0.12);

  switch (upgradeId) {
    case "pit_patch":
      repairSystem(next, "engine", 0.18);
      repairSystem(next, "radiator", 0.22);
      repairSystem(next, "transmission", 0.14);
      repairBody(next, "front", 0.14);
      repairBody(next, "left", 0.1);
      repairBody(next, "right", 0.1);
      next.frame = repairCarFrame(next.frame, 0.28);
      restoreAllLights(next);
      break;
    case "ram_rig":
      repairSystem(next, "engine", 0.08);
      repairSystem(next, "transmission", 0.12);
      repairBody(next, "front", 0.08);
      next.frame = repairCarFrame(next.frame, 0.12);
      break;
    case "steering_clinic":
      repairSystem(next, "steering", 0.24);
      repairSystem(next, "transmission", 0.08);
      repairBody(next, "left", 0.1);
      repairBody(next, "right", 0.1);
      next.frame = repairCarFrame(next.frame, 0.18);
      break;
  }

  return next;
}

export function towConditionToRunnableMinimum(
  condition: CarCondition,
): CarCondition {
  const next = cloneCondition(condition);
  next.systems.engine = Math.max(0.46, next.systems.engine);
  next.systems.radiator = Math.max(0.32, next.systems.radiator);
  next.systems.transmission = Math.max(0.32, next.systems.transmission);
  next.systems.steering = Math.max(0.32, next.systems.steering);
  next.systems.overheat = Math.min(0.7, next.systems.overheat);
  return next;
}
