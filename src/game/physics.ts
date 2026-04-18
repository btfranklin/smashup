import { applyImpactDamage, impactZoneForPoint, updateSubsystemWear } from "./damage";
import { clamp, normalizeAngle } from "./math";
import type { Car, CollisionEvent, Vec2 } from "./types";

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function perpendicular(axis: Vec2): Vec2 {
  return { x: -axis.y, y: axis.x };
}

function getAxes(car: Car): [Vec2, Vec2] {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const right = { x: -forward.y, y: forward.x };
  return [forward, right];
}

function getCorners(car: Car): Vec2[] {
  const [forward, right] = getAxes(car);
  const halfLength = car.length * 0.5;
  const halfWidth = car.width * 0.5;
  return [
    {
      x: car.x + forward.x * halfLength + right.x * halfWidth,
      y: car.y + forward.y * halfLength + right.y * halfWidth,
    },
    {
      x: car.x + forward.x * halfLength - right.x * halfWidth,
      y: car.y + forward.y * halfLength - right.y * halfWidth,
    },
    {
      x: car.x - forward.x * halfLength - right.x * halfWidth,
      y: car.y - forward.y * halfLength - right.y * halfWidth,
    },
    {
      x: car.x - forward.x * halfLength + right.x * halfWidth,
      y: car.y - forward.y * halfLength + right.y * halfWidth,
    },
  ];
}

function supportPoint(car: Car, direction: Vec2): Vec2 {
  const corners = getCorners(car);
  let best = corners[0];
  let bestScore = dot(best, direction);
  for (let i = 1; i < corners.length; i += 1) {
    const score = dot(corners[i], direction);
    if (score > bestScore) {
      best = corners[i];
      bestScore = score;
    }
  }
  return best;
}

function project(corners: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = dot(corners[0], axis);
  let max = min;
  for (let i = 1; i < corners.length; i += 1) {
    const projection = dot(corners[i], axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function overlapAmount(a: { min: number; max: number }, b: { min: number; max: number }): number {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min);
}

function resolveWallResponse(
  car: Car,
  inwardNormal: Vec2,
  tangentialAxis: Vec2,
  outwardSpeed: number,
): void {
  const tangentialSpeed = dot({ x: car.vx, y: car.vy }, tangentialAxis);
  const inwardBias = Math.max(26, 10 + outwardSpeed * 0.38);
  car.vx =
    inwardNormal.x * inwardBias +
    tangentialAxis.x * tangentialSpeed * 0.42;
  car.vy =
    inwardNormal.y * inwardBias +
    tangentialAxis.y * tangentialSpeed * 0.42;
  car.angularVelocity *= 0.3;
}

export function stepCar(
  car: Car,
  dt: number,
  arenaWidth: number,
  arenaHeight: number,
  wallPadding: number,
): void {
  updateSubsystemWear(car, dt);

  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;

  if (car.disabled) {
    car.controls.forward = 0;
    car.controls.reverse = 0;
    car.controls.steer = 0;
  }

  const enginePower = car.engineForce * (0.35 + car.systems.engine * 0.65);
  const reversePower = car.reverseForce * (0.25 + car.systems.transmission * 0.75);
  const wantsBrake =
    (car.controls.forward > 0 && car.controls.reverse > 0) ||
    (car.controls.forward > 0 && forwardSpeed < -8) ||
    (car.controls.reverse > 0 && forwardSpeed > 8);
  const throttleForce = wantsBrake
    ? 0
    : car.controls.forward * enginePower - car.controls.reverse * reversePower;
  const accelX = forwardX * throttleForce / car.mass;
  const accelY = forwardY * throttleForce / car.mass;
  car.vx += accelX * dt;
  car.vy += accelY * dt;
  if (wantsBrake && Math.abs(forwardSpeed) > 0.2) {
    const brakeDelta = Math.min(Math.abs(forwardSpeed), (car.brakeForce / car.mass) * dt);
    car.vx -= forwardX * Math.sign(forwardSpeed) * brakeDelta;
    car.vy -= forwardY * Math.sign(forwardSpeed) * brakeDelta;
  }

  const drag = clamp(0.992 - car.body.front * 0.012, 0.978, 0.992);
  car.vx *= Math.pow(drag, dt * 60);
  car.vy *= Math.pow(drag, dt * 60);

  const engineSpeedFactor = 0.55 + car.systems.engine * 0.45;
  const transmissionFactor = 0.45 + car.systems.transmission * 0.55;
  const forwardSpeedCap = car.forwardMaxSpeed * engineSpeedFactor;
  const reverseSpeedCap = car.reverseMaxSpeed * engineSpeedFactor * transmissionFactor;
  const postForceForwardSpeed = car.vx * forwardX + car.vy * forwardY;
  let cappedForwardSpeed = postForceForwardSpeed;
  if (cappedForwardSpeed > forwardSpeedCap) {
    cappedForwardSpeed = forwardSpeedCap;
  }
  if (cappedForwardSpeed < -reverseSpeedCap) {
    cappedForwardSpeed = -reverseSpeedCap;
  }
  if (cappedForwardSpeed !== postForceForwardSpeed) {
    const diff = cappedForwardSpeed - postForceForwardSpeed;
    car.vx += forwardX * diff;
    car.vy += forwardY * diff;
  }

  const correctedForwardSpeed = car.vx * forwardX + car.vy * forwardY;
  const correctedLateralSpeed = car.vx * rightX + car.vy * rightY;
  const lateralGrip = 0.82 + car.systems.steering * 0.14;
  const lateralReduction = correctedLateralSpeed * (1 - Math.pow(lateralGrip, dt * 60));
  car.vx -= rightX * lateralReduction;
  car.vy -= rightY * lateralReduction;

  const maxSteerAngle = 0.62 * (0.45 + car.systems.steering * 0.55);
  car.steerAngleTarget = clamp(car.controls.steer, -1, 1) * maxSteerAngle;
  const steerResponse = 4.1 + car.systems.steering * 2.6;
  car.steerAngle += (car.steerAngleTarget - car.steerAngle) * dt * steerResponse;

  const turnSpeedThreshold = 16;
  if (Math.abs(correctedForwardSpeed) >= turnSpeedThreshold && Math.abs(car.steerAngle) > 0.002) {
    const headingRate =
      (correctedForwardSpeed / Math.max(car.wheelbase, 1)) * Math.tan(car.steerAngle);
    car.angle = normalizeAngle(car.angle + clamp(headingRate, -2.1, 2.1) * dt);
  }

  car.angularVelocity *= Math.pow(0.92, dt * 60);
  car.angle = normalizeAngle(car.angle + car.angularVelocity * dt);

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const halfLength = car.length * 0.5;
  const halfWidth = car.width * 0.5;
  const wall = arenaWidth;
  const floor = arenaHeight;
  const xMin = halfLength + wallPadding;
  const xMax = wall - halfLength - wallPadding;
  const yMin = halfWidth + wallPadding;
  const yMax = floor - halfWidth - wallPadding;

  if (car.x < xMin) {
    car.x = xMin;
    resolveWallResponse(car, { x: 1, y: 0 }, { x: 0, y: 1 }, Math.max(0, -car.vx));
  } else if (car.x > xMax) {
    car.x = xMax;
    resolveWallResponse(car, { x: -1, y: 0 }, { x: 0, y: 1 }, Math.max(0, car.vx));
  }

  if (car.y < yMin) {
    car.y = yMin;
    resolveWallResponse(car, { x: 0, y: 1 }, { x: 1, y: 0 }, Math.max(0, -car.vy));
  } else if (car.y > yMax) {
    car.y = yMax;
    resolveWallResponse(car, { x: 0, y: -1 }, { x: 1, y: 0 }, Math.max(0, car.vy));
  }
}

export function resolveCarCollisions(cars: Car[]): CollisionEvent[] {
  const collisions: CollisionEvent[] = [];

  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const cornersA = getCorners(a);
      const cornersB = getCorners(b);
      const [forwardA, rightA] = getAxes(a);
      const [forwardB, rightB] = getAxes(b);
      const axes = [forwardA, rightA, forwardB, rightB].map(normalize);

      let minimumOverlap = Infinity;
      let smallestAxis: Vec2 | null = null;
      let separated = false;

      for (const axis of axes) {
        const projectionA = project(cornersA, axis);
        const projectionB = project(cornersB, axis);
        const overlap = overlapAmount(projectionA, projectionB);
        if (overlap <= 0) {
          separated = true;
          break;
        }
        if (overlap < minimumOverlap) {
          minimumOverlap = overlap;
          smallestAxis = axis;
        }
      }

      if (separated || !smallestAxis) {
        continue;
      }

      const between = { x: b.x - a.x, y: b.y - a.y };
      let normal = smallestAxis;
      if (dot(between, normal) < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }

      const totalMass = a.mass + b.mass;
      const correction = minimumOverlap + 1.5;
      a.x -= normal.x * correction * (b.mass / totalMass);
      a.y -= normal.y * correction * (b.mass / totalMass);
      b.x += normal.x * correction * (a.mass / totalMass);
      b.y += normal.y * correction * (a.mass / totalMass);

      const relativeVelocity = { x: b.vx - a.vx, y: b.vy - a.vy };
      const separatingSpeed = dot(relativeVelocity, normal);
      if (separatingSpeed < 0) {
        const restitution = 0.44;
        const impulse = (-(1 + restitution) * separatingSpeed) / (1 / a.mass + 1 / b.mass);
        const impulseX = impulse * normal.x;
        const impulseY = impulse * normal.y;
        a.vx -= impulseX / a.mass;
        a.vy -= impulseY / a.mass;
        b.vx += impulseX / b.mass;
        b.vy += impulseY / b.mass;

        const tangential = perpendicular(normal);
        const tangentSpeed = dot(relativeVelocity, tangential);
        const frictionImpulse =
          (-tangentSpeed * 0.18) / (1 / a.mass + 1 / b.mass);
        a.vx -= tangential.x * frictionImpulse / a.mass;
        a.vy -= tangential.y * frictionImpulse / a.mass;
        b.vx += tangential.x * frictionImpulse / b.mass;
        b.vy += tangential.y * frictionImpulse / b.mass;

        a.angularVelocity -= tangentSpeed * 0.00055;
        b.angularVelocity += tangentSpeed * 0.00055;

        const closingSpeed = -separatingSpeed;
        const pointOnA = supportPoint(a, normal);
        const pointOnB = supportPoint(b, { x: -normal.x, y: -normal.y });
        const zoneA = impactZoneForPoint(a, pointOnA);
        const zoneB = impactZoneForPoint(b, pointOnB);
        const frontClipBonus =
          (zoneA === "front" ? 0.16 : 0) +
          (zoneB === "front" ? 0.16 : 0) +
          (zoneA === "rear" ? 0.06 : 0) +
          (zoneB === "rear" ? 0.06 : 0);
        const severity = clamp((closingSpeed - 10) / 85 + frontClipBonus, 0, 1);
        const damageSeverityBase = clamp((closingSpeed - 42) / 66, 0, 1);
        const damageSeverity = damageSeverityBase * damageSeverityBase;
        if (severity > 0) {
          const point = {
            x: (pointOnA.x + pointOnB.x) * 0.5,
            y: (pointOnA.y + pointOnB.y) * 0.5,
          };
          if (damageSeverity > 0) {
            applyImpactDamage(a, pointOnA, damageSeverity, { x: -normal.x, y: -normal.y });
            applyImpactDamage(b, pointOnB, damageSeverity, normal);
          }
          collisions.push({
            aId: a.id,
            bId: b.id,
            point,
            normal,
            severity,
            damageSeverity,
            zoneA,
            zoneB,
          });
        }
      }
    }
  }

  return collisions;
}
