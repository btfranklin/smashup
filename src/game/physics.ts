import { applyImpactDamage, impactZoneForPoint, updateSubsystemWear } from "./damage";
import { clamp, normalizeAngle } from "./math";
import type { ArenaObject, Car, CollisionEvent, GameState, MudZone, Vec2 } from "./types";

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

function getGroundGrip(car: Car, mudZones: MudZone[]): number {
  let grip = car.tractionBias;
  for (const zone of mudZones) {
    if (
      car.x > zone.x &&
      car.x < zone.x + zone.width &&
      car.y > zone.y &&
      car.y < zone.y + zone.height
    ) {
      grip = Math.min(grip, zone.grip * car.tractionBias);
    }
  }
  return grip;
}

export function stepCar(
  car: Car,
  dt: number,
  arena: GameState["arena"],
  mudZones: MudZone[],
): void {
  const heatFactor = arena.modifier === "hot_engines" ? 1.45 : 1;
  updateSubsystemWear(car, dt * heatFactor);

  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  const groundGrip = getGroundGrip(car, mudZones);

  if (car.disabled) {
    car.controls.forward = 0;
    car.controls.reverse = 0;
    car.controls.steer = 0;
  }

  const desiredDrive = car.controls.forward - car.controls.reverse;
  const transmissionResponse = (3.2 + car.systems.transmission * 4.6) * car.steeringSharpness;
  car.driveInput += (desiredDrive - car.driveInput) * dt * transmissionResponse;

  const enginePower = car.engineForce * (0.32 + car.systems.engine * 0.68);
  const reversePower = car.reverseForce * (0.2 + car.systems.transmission * 0.8);
  const wantsBrake =
    (car.controls.forward > 0 && car.controls.reverse > 0) ||
    (car.controls.forward > 0 && forwardSpeed < -8) ||
    (car.controls.reverse > 0 && forwardSpeed > 8);
  const throttleForce = wantsBrake
    ? 0
    : car.driveInput >= 0
      ? car.driveInput * enginePower * clamp(groundGrip * 1.04, 0.72, 1.08)
      : car.driveInput * reversePower * clamp(groundGrip * 1.08, 0.72, 1.12);

  const accelX = forwardX * throttleForce / car.mass;
  const accelY = forwardY * throttleForce / car.mass;
  car.vx += accelX * dt;
  car.vy += accelY * dt;
  if (wantsBrake && Math.abs(forwardSpeed) > 0.2) {
    const brakeDelta = Math.min(Math.abs(forwardSpeed), (car.brakeForce / car.mass) * dt);
    car.vx -= forwardX * Math.sign(forwardSpeed) * brakeDelta;
    car.vy -= forwardY * Math.sign(forwardSpeed) * brakeDelta;
  }

  const drag = clamp(0.992 - car.body.front * 0.014 + (1 - groundGrip) * 0.004, 0.97, 0.994);
  car.vx *= Math.pow(drag, dt * 60);
  car.vy *= Math.pow(drag, dt * 60);

  const engineSpeedFactor = 0.45 + car.systems.engine * 0.55;
  const transmissionFactor = 0.32 + car.systems.transmission * 0.68;
  const forwardSpeedCap = (car.forwardMaxSpeed * engineSpeedFactor) * clamp(groundGrip * 1.02, 0.78, 1.05);
  const reverseSpeedCap = car.reverseMaxSpeed * engineSpeedFactor * transmissionFactor * clamp(groundGrip * 1.04, 0.8, 1.06);
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
  car.slipAmount = Math.abs(correctedLateralSpeed);
  const lateralGrip = clamp((0.72 + car.systems.steering * 0.19) * groundGrip, 0.44, 0.98);
  const lateralReduction = correctedLateralSpeed * (1 - Math.pow(lateralGrip, dt * 60));
  car.vx -= rightX * lateralReduction;
  car.vy -= rightY * lateralReduction;

  const maxSteerAngle = 0.62 * (0.42 + car.systems.steering * 0.58) * car.steeringSharpness;
  car.steerAngleTarget = clamp(car.controls.steer, -1, 1) * maxSteerAngle;
  const steerResponse = (3.4 + car.systems.steering * 3.4) * car.steeringSharpness;
  car.steerAngle += (car.steerAngleTarget - car.steerAngle) * dt * steerResponse;

  const turnSpeedThreshold = 16;
  if (Math.abs(correctedForwardSpeed) >= turnSpeedThreshold && Math.abs(car.steerAngle) > 0.002) {
    const headingRate =
      (correctedForwardSpeed / Math.max(car.wheelbase, 1)) * Math.tan(car.steerAngle);
    car.angle = normalizeAngle(car.angle + clamp(headingRate, -2.1, 2.1) * dt);
  }

  const steeringPull =
    (car.body.left - car.body.right) * (1 - car.systems.steering) * 1.15 +
    (car.body.front * 0.22) * Math.sign(correctedForwardSpeed || 1);
  car.angularVelocity += steeringPull * dt * 0.45;
  car.angularVelocity *= Math.pow(0.91, dt * 60);
  car.angle = normalizeAngle(car.angle + car.angularVelocity * dt);

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const halfLength = car.length * 0.5;
  const halfWidth = car.width * 0.5;
  const xMin = halfLength + arena.wallPadding;
  const xMax = arena.width - halfLength - arena.wallPadding;
  const yMin = halfWidth + arena.wallPadding;
  const yMax = arena.height - halfWidth - arena.wallPadding;

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

export function stepArenaObjects(
  objects: ArenaObject[],
  dt: number,
  arena: GameState["arena"],
): void {
  for (const object of objects) {
    object.x += object.vx * dt;
    object.y += object.vy * dt;
    object.vx *= Math.pow(0.972, dt * 60);
    object.vy *= Math.pow(0.972, dt * 60);
    object.rotation += object.spin * dt;
    object.spin *= Math.pow(0.93, dt * 60);

    const minX = arena.wallPadding + object.radius;
    const maxX = arena.width - arena.wallPadding - object.radius;
    const minY = arena.wallPadding + object.radius;
    const maxY = arena.height - arena.wallPadding - object.radius;

    if (object.x < minX) {
      object.x = minX;
      object.vx = Math.abs(object.vx) * 0.55;
    } else if (object.x > maxX) {
      object.x = maxX;
      object.vx = -Math.abs(object.vx) * 0.55;
    }
    if (object.y < minY) {
      object.y = minY;
      object.vy = Math.abs(object.vy) * 0.55;
    } else if (object.y > maxY) {
      object.y = maxY;
      object.vy = -Math.abs(object.vy) * 0.55;
    }
  }
}

export function resolveArenaObjectInteractions(
  cars: Car[],
  objects: ArenaObject[],
  arena: GameState["arena"],
): void {
  for (const car of cars) {
    const [forward, right] = getAxes(car);
    const halfLength = car.length * 0.5;
    const halfWidth = car.width * 0.5;
    for (const object of objects) {
      const localX = (object.x - car.x) * forward.x + (object.y - car.y) * forward.y;
      const localY = (object.x - car.x) * right.x + (object.y - car.y) * right.y;
      const closestX = clamp(localX, -halfLength, halfLength);
      const closestY = clamp(localY, -halfWidth, halfWidth);
      const dx = localX - closestX;
      const dy = localY - closestY;
      const distance = Math.hypot(dx, dy);
      if (distance >= object.radius || distance === 0) {
        continue;
      }

      const worldNormal = normalize({
        x: forward.x * dx + right.x * dy,
        y: forward.y * dx + right.y * dy,
      });
      const overlap = object.radius - distance;
      car.x -= worldNormal.x * overlap * 0.3;
      car.y -= worldNormal.y * overlap * 0.3;
      object.x += worldNormal.x * overlap * 0.7;
      object.y += worldNormal.y * overlap * 0.7;

      const relativeVelocity = {
        x: car.vx - object.vx,
        y: car.vy - object.vy,
      };
      const normalSpeed = dot(relativeVelocity, worldNormal);
      if (normalSpeed > 0) {
        object.vx += worldNormal.x * normalSpeed * 0.9;
        object.vy += worldNormal.y * normalSpeed * 0.9;
        car.vx -= worldNormal.x * normalSpeed * 0.18;
        car.vy -= worldNormal.y * normalSpeed * 0.18;
        object.spin += normalSpeed * 0.01 * (object.kind === "tire" ? 1.4 : 0.8);
      }
    }
  }
  stepArenaObjects(objects, 0, arena);
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
