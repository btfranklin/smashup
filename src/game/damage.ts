import { clamp01 } from "./math";
import type { Car, DamagePhase, DamageZone, SystemName, Vec2 } from "./types";

export function getLocalImpact(car: Car, point: Vec2): { forward: number; side: number } {
  const dx = point.x - car.x;
  const dy = point.y - car.y;
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;

  return {
    forward: dx * forwardX + dy * forwardY,
    side: dx * rightX + dy * rightY,
  };
}

function getLocalDirection(car: Car, direction: Vec2): { forward: number; side: number } {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;

  return {
    forward: direction.x * forwardX + direction.y * forwardY,
    side: direction.x * rightX + direction.y * rightY,
  };
}

export function impactZoneForPoint(car: Car, point: Vec2): DamageZone {
  const local = getLocalImpact(car, point);
  const frontBias = Math.abs(local.forward) / (car.length * 0.5);
  const sideBias = Math.abs(local.side) / (car.width * 0.5);

  if (frontBias >= sideBias) {
    return local.forward >= 0 ? "front" : "rear";
  }
  return local.side >= 0 ? "right" : "left";
}

function breakFrontLight(car: Car, side: number): void {
  if (side < 0) {
    car.lights.frontLeft = false;
  } else {
    car.lights.frontRight = false;
  }
}

function breakRearLight(car: Car, side: number): void {
  if (side < 0) {
    car.lights.rearLeft = false;
  } else {
    car.lights.rearRight = false;
  }
}

function disableCar(car: Car): void {
  car.disabled = true;
  car.lights.frontLeft = false;
  car.lights.frontRight = false;
  car.lights.rearLeft = false;
  car.lights.rearRight = false;
}

export function getEngineHealth(car: Car): number {
  return (
    car.systems.engine * 0.45 +
    car.systems.radiator * 0.25 +
    car.systems.transmission * 0.2 +
    car.systems.steering * 0.1
  );
}

export function getTotalBodyDamage(car: Car): number {
  return car.body.front + car.body.rear + car.body.left + car.body.right;
}

export function getSystemPhase(value: number): DamagePhase {
  if (value >= 0.78) {
    return "healthy";
  }
  if (value >= 0.58) {
    return "wounded";
  }
  if (value >= 0.36) {
    return "failing";
  }
  return "critical";
}

export function getCarSystemPhases(car: Car): Record<SystemName, DamagePhase> {
  return {
    engine: getSystemPhase(car.systems.engine),
    radiator: getSystemPhase(car.systems.radiator),
    transmission: getSystemPhase(car.systems.transmission),
    steering: getSystemPhase(car.systems.steering),
  };
}

export function applyImpactDamage(
  car: Car,
  point: Vec2,
  severity: number,
  receivedImpulseDirection: Vec2,
): void {
  if (car.disabled) {
    return;
  }

  const scaled = Math.max(0, severity);
  const zone = impactZoneForPoint(car, point);
  const local = getLocalImpact(car, point);
  const side = local.side;
  const localDirection = getLocalDirection(car, receivedImpulseDirection);
  const zoneDirectness =
    zone === "front"
      ? Math.max(0, -localDirection.forward)
      : zone === "rear"
        ? Math.max(0, localDirection.forward)
        : zone === "left"
          ? Math.max(0, localDirection.side)
          : Math.max(0, -localDirection.side);
  const structuralSeverity = scaled * (0.18 + zoneDirectness * 0.82);
  const drivetrainSeverity =
    zone === "front"
      ? scaled * Math.pow(zoneDirectness, 1.9)
      : zone === "rear"
        ? scaled * Math.pow(zoneDirectness, 1.35) * 0.7
        : scaled * Math.pow(zoneDirectness, 1.5) * 0.45;
  const frontArmor = car.frontArmor || 1;
  const bodyArmor = car.bodyArmor || 1;
  const frontStructural = structuralSeverity / frontArmor;
  const frontDrivetrain = drivetrainSeverity / frontArmor;
  const bodyStructural = structuralSeverity / bodyArmor;
  const bodyDrivetrain = drivetrainSeverity / bodyArmor;

  if (zone === "front") {
    car.body.front = clamp01(car.body.front + frontStructural * 0.12);
    car.systems.engine = clamp01(car.systems.engine - frontDrivetrain * 0.26);
    car.systems.radiator = clamp01(car.systems.radiator - frontDrivetrain * 0.29);
    car.systems.transmission = clamp01(car.systems.transmission - frontDrivetrain * 0.17);
    car.systems.steering = clamp01(
      car.systems.steering - (frontStructural * 0.03 + frontDrivetrain * 0.11),
    );
    if (frontStructural > 0.24) {
      breakFrontLight(car, side);
    }
    if (frontStructural > 0.46) {
      car.lights.frontLeft = car.lights.frontLeft && side > 0;
      car.lights.frontRight = car.lights.frontRight && side < 0;
    }
  } else if (zone === "rear") {
    const rearWeaponSeverity = bodyStructural * 0.55;
    car.body.rear = clamp01(car.body.rear + rearWeaponSeverity * 0.08);
    car.systems.engine = clamp01(car.systems.engine - bodyDrivetrain * 0.015);
    car.systems.transmission = clamp01(car.systems.transmission - bodyDrivetrain * 0.035);
    if (rearWeaponSeverity > 0.22) {
      breakRearLight(car, side);
    }
    if (rearWeaponSeverity > 0.4) {
      car.lights.rearLeft = car.lights.rearLeft && side > 0;
      car.lights.rearRight = car.lights.rearRight && side < 0;
    }
  } else if (zone === "left") {
    car.body.left = clamp01(car.body.left + bodyStructural * 0.1);
    car.systems.engine = clamp01(car.systems.engine - bodyDrivetrain * 0.03);
    car.systems.steering = clamp01(car.systems.steering - bodyDrivetrain * 0.1);
    car.systems.transmission = clamp01(car.systems.transmission - bodyDrivetrain * 0.04);
  } else {
    car.body.right = clamp01(car.body.right + bodyStructural * 0.1);
    car.systems.engine = clamp01(car.systems.engine - bodyDrivetrain * 0.03);
    car.systems.steering = clamp01(car.systems.steering - bodyDrivetrain * 0.1);
    car.systems.transmission = clamp01(car.systems.transmission - bodyDrivetrain * 0.04);
  }

  const engineHealth = getEngineHealth(car);
  const totalBodyDamage = getTotalBodyDamage(car);
  const catastrophicFrontHit =
    zone === "front" &&
    frontDrivetrain > 0.72 &&
    zoneDirectness > 0.82 &&
    (engineHealth < 0.56 || (car.body.front > 0.16 && car.systems.engine < 0.58));

  if (
    catastrophicFrontHit ||
    engineHealth <= 0.24 ||
    car.systems.overheat >= 1 ||
    totalBodyDamage > 1.68 ||
    (totalBodyDamage > 1.12 && engineHealth < 0.62)
  ) {
    disableCar(car);
  }
}

export function updateSubsystemWear(car: Car, dt: number): void {
  if (car.disabled) {
    return;
  }

  const throttle = Math.max(car.controls.forward, car.controls.reverse);
  const radiatorLoss = 1 - car.systems.radiator;
  const heatRate = throttle * radiatorLoss * 0.08 + Math.max(0, radiatorLoss - 0.35) * 0.06;
  const coolRate = 0.02 + car.systems.radiator * 0.035 - throttle * 0.006;
  car.systems.overheat = clamp01(car.systems.overheat + (heatRate - coolRate) * dt);
  car.systems.engine = clamp01(
    car.systems.engine - Math.max(0, car.systems.overheat - 0.78) * dt * 0.05,
  );

  const engineHealth = getEngineHealth(car);
  const totalBodyDamage = getTotalBodyDamage(car);
  if (
    engineHealth <= 0.24 ||
    car.systems.overheat >= 1 ||
    totalBodyDamage > 1.68 ||
    (totalBodyDamage > 1.12 && engineHealth < 0.62)
  ) {
    disableCar(car);
  }
}
