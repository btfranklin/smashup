import {
  applyImpactDamage,
  impactZoneForPoint,
  updateSubsystemWear,
} from "./damage";
import type { RoundModifierId } from "./contentIds";
import { clamp, normalizeAngle } from "./math";
import type {
  ArenaObject,
  Car,
  CarFrameState,
  CollisionEvent,
  GameState,
  MudZone,
  Vec2,
} from "./types";

const COLLISION_EPSILON = 1e-7;

type LocalHullCacheEntry = {
  coordinates: number[];
  hull: Vec2[];
};

type WorldHullCacheEntry = {
  localHull: Vec2[];
  hull: Vec2[];
  x: number;
  y: number;
  angle: number;
};

const localCollisionHullCache = new WeakMap<
  CarFrameState,
  LocalHullCacheEntry
>();
const worldCollisionHullCache = new WeakMap<Car, WorldHullCacheEntry>();

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function perpendicular(axis: Vec2): Vec2 {
  return { x: -axis.y, y: axis.x };
}

function cross(origin: Vec2, a: Vec2, b: Vec2): number {
  return (
    (a.x - origin.x) * (b.y - origin.y) -
    (a.y - origin.y) * (b.x - origin.x)
  );
}

function getLocalCollisionHull(car: Car): Vec2[] {
  const cached = localCollisionHullCache.get(car.frame);
  const coordinateCount = car.frame.vertices.length * 2;
  if (cached && cached.coordinates.length === coordinateCount) {
    let unchanged = true;
    for (let index = 0; index < car.frame.vertices.length; index += 1) {
      const vertex = car.frame.vertices[index];
      if (
        cached.coordinates[index * 2] !== vertex.x ||
        cached.coordinates[index * 2 + 1] !== vertex.y
      ) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) {
      return cached.hull;
    }
  }

  const coordinates = new Array<number>(coordinateCount);
  const points = car.frame.vertices
    .map((vertex, index) => {
      coordinates[index * 2] = vertex.x;
      coordinates[index * 2 + 1] = vertex.y;
      return { x: vertex.x, y: vertex.y };
    })
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Vec2[] = [];
  const upper: Vec2[] = [];

  for (const point of points) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <=
        COLLISION_EPSILON
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <=
        COLLISION_EPSILON
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  localCollisionHullCache.set(car.frame, { coordinates, hull });
  return hull;
}

function getWorldCollisionHull(car: Car, localHull: Vec2[]): Vec2[] {
  let cached = worldCollisionHullCache.get(car);
  if (!cached || cached.localHull !== localHull) {
    cached = {
      localHull,
      hull: localHull.map(() => ({ x: 0, y: 0 })),
      x: Number.NaN,
      y: Number.NaN,
      angle: Number.NaN,
    };
    worldCollisionHullCache.set(car, cached);
  }
  if (cached.x === car.x && cached.y === car.y && cached.angle === car.angle) {
    return cached.hull;
  }

  const cosine = Math.cos(car.angle);
  const sine = Math.sin(car.angle);
  for (let index = 0; index < localHull.length; index += 1) {
    const localPoint = localHull[index];
    const worldPoint = cached.hull[index];
    worldPoint.x = car.x + localPoint.x * cosine - localPoint.y * sine;
    worldPoint.y = car.y + localPoint.x * sine + localPoint.y * cosine;
  }
  cached.x = car.x;
  cached.y = car.y;
  cached.angle = car.angle;
  return cached.hull;
}

function translateHull(hull: Vec2[], x: number, y: number): void {
  for (const point of hull) {
    point.x += x;
    point.y += y;
  }
}

function supportPoint(hull: Vec2[], direction: Vec2): Vec2 {
  let bestScore = dot(hull[0], direction);
  let x = hull[0].x;
  let y = hull[0].y;
  let count = 1;
  for (let index = 1; index < hull.length; index += 1) {
    const point = hull[index];
    const score = dot(point, direction);
    if (score > bestScore + COLLISION_EPSILON) {
      bestScore = score;
      x = point.x;
      y = point.y;
      count = 1;
    } else if (Math.abs(score - bestScore) <= COLLISION_EPSILON) {
      x += point.x;
      y += point.y;
      count += 1;
    }
  }
  return { x: x / count, y: y / count };
}

function getCollisionOverlap(
  firstHull: Vec2[],
  secondHull: Vec2[],
): { amount: number; axis: Vec2 } | null {
  let minimumOverlap = Infinity;
  let smallestAxisX = 0;
  let smallestAxisY = 0;

  for (let hullIndex = 0; hullIndex < 2; hullIndex += 1) {
    const sourceHull = hullIndex === 0 ? firstHull : secondHull;
    for (let index = 0; index < sourceHull.length; index += 1) {
      const point = sourceHull[index];
      const next = sourceHull[(index + 1) % sourceHull.length];
      const edgeX = next.x - point.x;
      const edgeY = next.y - point.y;
      const edgeLength = Math.hypot(edgeX, edgeY);
      const axisX = -edgeY / edgeLength;
      const axisY = edgeX / edgeLength;

      let firstMin = firstHull[0].x * axisX + firstHull[0].y * axisY;
      let firstMax = firstMin;
      for (
        let pointIndex = 1;
        pointIndex < firstHull.length;
        pointIndex += 1
      ) {
        const projection =
          firstHull[pointIndex].x * axisX + firstHull[pointIndex].y * axisY;
        firstMin = Math.min(firstMin, projection);
        firstMax = Math.max(firstMax, projection);
      }

      let secondMin = secondHull[0].x * axisX + secondHull[0].y * axisY;
      let secondMax = secondMin;
      for (
        let pointIndex = 1;
        pointIndex < secondHull.length;
        pointIndex += 1
      ) {
        const projection =
          secondHull[pointIndex].x * axisX + secondHull[pointIndex].y * axisY;
        secondMin = Math.min(secondMin, projection);
        secondMax = Math.max(secondMax, projection);
      }

      const overlap =
        Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
      if (overlap <= 0) {
        return null;
      }
      if (overlap < minimumOverlap) {
        minimumOverlap = overlap;
        smallestAxisX = axisX;
        smallestAxisY = axisY;
      }
    }
  }

  return {
    amount: minimumOverlap,
    axis: { x: smallestAxisX, y: smallestAxisY },
  };
}

function getCircleCollisionOverlap(
  hull: Vec2[],
  center: Vec2,
  radius: number,
): { amount: number; axis: Vec2 } | null {
  let inside = true;
  let closestDistanceSquared = Infinity;
  let closestX = 0;
  let closestY = 0;
  let nearestFaceDistance = Infinity;
  let nearestFaceNormalX = 0;
  let nearestFaceNormalY = 1;

  for (let index = 0; index < hull.length; index += 1) {
    const point = hull[index];
    const next = hull[(index + 1) % hull.length];
    const edgeX = next.x - point.x;
    const edgeY = next.y - point.y;
    const edgeLengthSquared = edgeX * edgeX + edgeY * edgeY;
    const edgeLength = Math.sqrt(edgeLengthSquared);
    const signedDistance = cross(point, next, center) / edgeLength;
    const outwardNormalX = edgeY / edgeLength;
    const outwardNormalY = -edgeX / edgeLength;
    const tiedFace =
      Math.abs(signedDistance - nearestFaceDistance) <= COLLISION_EPSILON;
    const preferredTie =
      outwardNormalY > nearestFaceNormalY + COLLISION_EPSILON ||
      (Math.abs(outwardNormalY - nearestFaceNormalY) <= COLLISION_EPSILON &&
        outwardNormalX > nearestFaceNormalX);
    if (
      signedDistance < nearestFaceDistance - COLLISION_EPSILON ||
      (tiedFace && preferredTie)
    ) {
      nearestFaceDistance = signedDistance;
      nearestFaceNormalX = outwardNormalX;
      nearestFaceNormalY = outwardNormalY;
    }
    if (signedDistance < -COLLISION_EPSILON) {
      inside = false;
    }

    const pointToCenterX = center.x - point.x;
    const pointToCenterY = center.y - point.y;
    const segmentPosition = clamp(
      (pointToCenterX * edgeX + pointToCenterY * edgeY) / edgeLengthSquared,
      0,
      1,
    );
    const segmentX = point.x + edgeX * segmentPosition;
    const segmentY = point.y + edgeY * segmentPosition;
    const distanceX = center.x - segmentX;
    const distanceY = center.y - segmentY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestX = segmentX;
      closestY = segmentY;
    }
  }

  if (inside) {
    return {
      amount: radius + Math.max(0, nearestFaceDistance),
      axis: { x: nearestFaceNormalX, y: nearestFaceNormalY },
    };
  }
  if (closestDistanceSquared >= radius * radius) {
    return null;
  }

  const distance = Math.sqrt(closestDistanceSquared);
  if (distance <= COLLISION_EPSILON) {
    return {
      amount: radius,
      axis: { x: nearestFaceNormalX, y: nearestFaceNormalY },
    };
  }
  return {
    amount: radius - distance,
    axis: {
      x: (center.x - closestX) / distance,
      y: (center.y - closestY) / distance,
    },
  };
}

function damageScaleForZones(
  selfZone: ReturnType<typeof impactZoneForPoint>,
  otherZone: ReturnType<typeof impactZoneForPoint>,
): number {
  if (selfZone === "front" && otherZone === "rear") {
    return 0.38;
  }
  if (selfZone === "rear" && otherZone === "front") {
    return 0.2;
  }
  return 1;
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
    inwardNormal.x * inwardBias + tangentialAxis.x * tangentialSpeed * 0.42;
  car.vy =
    inwardNormal.y * inwardBias + tangentialAxis.y * tangentialSpeed * 0.42;
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
  modifier: RoundModifierId,
): void {
  updateSubsystemWear(car, dt, modifier);

  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  const groundGrip = getGroundGrip(car, arena.mudZones);

  if (car.disabled) {
    car.controls.forward = 0;
    car.controls.reverse = 0;
    car.controls.steer = 0;
  }

  const desiredDrive = car.controls.forward - car.controls.reverse;
  const transmissionResponse =
    (3.2 + car.systems.transmission * 4.6) * car.steeringSharpness;
  car.driveInput += (desiredDrive - car.driveInput) * dt * transmissionResponse;

  const enginePower = car.engineForce * (0.32 + car.systems.engine * 0.68);
  const reversePower =
    car.reverseForce * (0.2 + car.systems.transmission * 0.8);
  const wantsBrake =
    (car.controls.forward > 0 && car.controls.reverse > 0) ||
    (car.controls.forward > 0 && forwardSpeed < -8) ||
    (car.controls.reverse > 0 && forwardSpeed > 8);
  const throttleForce = wantsBrake
    ? 0
    : car.driveInput >= 0
      ? car.driveInput * enginePower * clamp(groundGrip * 1.04, 0.72, 1.08)
      : car.driveInput * reversePower * clamp(groundGrip * 1.08, 0.72, 1.12);

  const accelX = (forwardX * throttleForce) / car.mass;
  const accelY = (forwardY * throttleForce) / car.mass;
  car.vx += accelX * dt;
  car.vy += accelY * dt;
  if (wantsBrake && Math.abs(forwardSpeed) > 0.2) {
    const brakeDelta = Math.min(
      Math.abs(forwardSpeed),
      (car.brakeForce / car.mass) * dt,
    );
    car.vx -= forwardX * Math.sign(forwardSpeed) * brakeDelta;
    car.vy -= forwardY * Math.sign(forwardSpeed) * brakeDelta;
  }

  const drag = clamp(
    0.992 - car.body.front * 0.014 + (1 - groundGrip) * 0.004,
    0.97,
    0.994,
  );
  car.vx *= Math.pow(drag, dt * 60);
  car.vy *= Math.pow(drag, dt * 60);

  const engineSpeedFactor = 0.45 + car.systems.engine * 0.55;
  const transmissionFactor = 0.32 + car.systems.transmission * 0.68;
  const forwardSpeedCap =
    car.forwardMaxSpeed *
    engineSpeedFactor *
    clamp(groundGrip * 1.02, 0.78, 1.05);
  const reverseSpeedCap =
    car.reverseMaxSpeed *
    engineSpeedFactor *
    transmissionFactor *
    clamp(groundGrip * 1.04, 0.8, 1.06);
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
  const lateralGrip = clamp(
    (0.72 + car.systems.steering * 0.19) * groundGrip,
    0.44,
    0.98,
  );
  const lateralReduction =
    correctedLateralSpeed * (1 - Math.pow(lateralGrip, dt * 60));
  car.vx -= rightX * lateralReduction;
  car.vy -= rightY * lateralReduction;

  const maxSteerAngle =
    0.62 * (0.42 + car.systems.steering * 0.58) * car.steeringSharpness;
  car.steerAngleTarget = clamp(car.controls.steer, -1, 1) * maxSteerAngle;
  const steerResponse =
    (3.4 + car.systems.steering * 3.4) * car.steeringSharpness;
  car.steerAngle +=
    (car.steerAngleTarget - car.steerAngle) * dt * steerResponse;

  const turnSpeedThreshold = 16;
  if (
    Math.abs(correctedForwardSpeed) >= turnSpeedThreshold &&
    Math.abs(car.steerAngle) > 0.002
  ) {
    const headingRate =
      (correctedForwardSpeed / Math.max(car.wheelbase, 1)) *
      Math.tan(car.steerAngle);
    car.angle = normalizeAngle(car.angle + clamp(headingRate, -2.1, 2.1) * dt);
  }

  const steeringPull =
    (car.body.left - car.body.right) * (1 - car.systems.steering) * 1.15 +
    car.body.front * 0.22 * Math.sign(correctedForwardSpeed || 1);
  car.angularVelocity += steeringPull * dt * 0.45;
  car.angularVelocity *= Math.pow(0.91, dt * 60);
  car.angle = normalizeAngle(car.angle + car.angularVelocity * dt);

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const wallHull = getWorldCollisionHull(car, getLocalCollisionHull(car));
  let minimumX = wallHull[0].x;
  let maximumX = minimumX;
  let minimumY = wallHull[0].y;
  let maximumY = minimumY;
  for (let index = 1; index < wallHull.length; index += 1) {
    minimumX = Math.min(minimumX, wallHull[index].x);
    maximumX = Math.max(maximumX, wallHull[index].x);
    minimumY = Math.min(minimumY, wallHull[index].y);
    maximumY = Math.max(maximumY, wallHull[index].y);
  }

  if (minimumX < arena.wallPadding) {
    const correction = arena.wallPadding - minimumX;
    car.x += correction;
    translateHull(wallHull, correction, 0);
    resolveWallResponse(
      car,
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      Math.max(0, -car.vx),
    );
  } else if (maximumX > arena.width - arena.wallPadding) {
    const correction = arena.width - arena.wallPadding - maximumX;
    car.x += correction;
    translateHull(wallHull, correction, 0);
    resolveWallResponse(
      car,
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      Math.max(0, car.vx),
    );
  }

  if (minimumY < arena.wallPadding) {
    const correction = arena.wallPadding - minimumY;
    car.y += correction;
    translateHull(wallHull, 0, correction);
    resolveWallResponse(
      car,
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      Math.max(0, -car.vy),
    );
  } else if (maximumY > arena.height - arena.wallPadding) {
    const correction = arena.height - arena.wallPadding - maximumY;
    car.y += correction;
    translateHull(wallHull, 0, correction);
    resolveWallResponse(
      car,
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      Math.max(0, car.vy),
    );
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
    const carHull = getWorldCollisionHull(car, getLocalCollisionHull(car));
    for (const object of objects) {
      const overlap = getCircleCollisionOverlap(
        carHull,
        object,
        object.radius,
      );
      if (!overlap) {
        continue;
      }

      const carCorrectionX = -overlap.axis.x * overlap.amount * 0.3;
      const carCorrectionY = -overlap.axis.y * overlap.amount * 0.3;
      car.x += carCorrectionX;
      car.y += carCorrectionY;
      object.x += overlap.axis.x * overlap.amount * 0.7;
      object.y += overlap.axis.y * overlap.amount * 0.7;
      translateHull(carHull, carCorrectionX, carCorrectionY);

      const relativeVelocity = {
        x: car.vx - object.vx,
        y: car.vy - object.vy,
      };
      const normalSpeed = dot(relativeVelocity, overlap.axis);
      if (normalSpeed > 0) {
        object.vx += overlap.axis.x * normalSpeed * 0.9;
        object.vy += overlap.axis.y * normalSpeed * 0.9;
        car.vx -= overlap.axis.x * normalSpeed * 0.18;
        car.vy -= overlap.axis.y * normalSpeed * 0.18;
        object.spin +=
          normalSpeed * 0.01 * (object.kind === "tire" ? 1.4 : 0.8);
      }
    }
  }
  stepArenaObjects(objects, 0, arena);
}

export function resolveCarCollisions(cars: Car[]): CollisionEvent[] {
  const collisions: CollisionEvent[] = [];
  const localHulls = cars.map((car) => getLocalCollisionHull(car));
  const worldHulls = cars.map((car, index) =>
    getWorldCollisionHull(car, localHulls[index]),
  );

  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const hullA = worldHulls[i];
      const hullB = worldHulls[j];
      const overlap = getCollisionOverlap(hullA, hullB);
      if (!overlap) {
        continue;
      }

      const between = { x: b.x - a.x, y: b.y - a.y };
      let normal = overlap.axis;
      if (dot(between, normal) < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }

      const totalMass = a.mass + b.mass;
      const correction = overlap.amount + 1.5;
      const correctionA = correction * (b.mass / totalMass);
      const correctionB = correction * (a.mass / totalMass);
      const correctionAX = -normal.x * correctionA;
      const correctionAY = -normal.y * correctionA;
      const correctionBX = normal.x * correctionB;
      const correctionBY = normal.y * correctionB;
      a.x += correctionAX;
      a.y += correctionAY;
      b.x += correctionBX;
      b.y += correctionBY;
      translateHull(hullA, correctionAX, correctionAY);
      translateHull(hullB, correctionBX, correctionBY);

      const relativeVelocity = { x: b.vx - a.vx, y: b.vy - a.vy };
      const separatingSpeed = dot(relativeVelocity, normal);
      if (separatingSpeed < 0) {
        const aActiveAtImpact = !a.disabled;
        const bActiveAtImpact = !b.disabled;
        const restitution = 0.44;
        const impulse =
          (-(1 + restitution) * separatingSpeed) / (1 / a.mass + 1 / b.mass);
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
        a.vx -= (tangential.x * frictionImpulse) / a.mass;
        a.vy -= (tangential.y * frictionImpulse) / a.mass;
        b.vx += (tangential.x * frictionImpulse) / b.mass;
        b.vy += (tangential.y * frictionImpulse) / b.mass;

        a.angularVelocity -= tangentSpeed * 0.00055;
        b.angularVelocity += tangentSpeed * 0.00055;

        const closingSpeed = -separatingSpeed;
        const pointOnA = supportPoint(hullA, normal);
        const pointOnB = supportPoint(
          hullB,
          { x: -normal.x, y: -normal.y },
        );
        const zoneA = impactZoneForPoint(a, pointOnA);
        const zoneB = impactZoneForPoint(b, pointOnB);
        const frontClipBonus =
          (zoneA === "front" ? 0.16 : 0) +
          (zoneB === "front" ? 0.16 : 0) +
          (zoneA === "rear" ? 0.06 : 0) +
          (zoneB === "rear" ? 0.06 : 0);
        const severity = clamp((closingSpeed - 10) / 85 + frontClipBonus, 0, 1);
        const damageSeverityBase = clamp((closingSpeed - 42) / 155, 0, 1);
        const damageSeverity =
          damageSeverityBase <= 0
            ? 0
            : clamp(
                Math.pow(damageSeverityBase, 2.2) *
                  (0.7 + Math.pow(damageSeverityBase, 1.35) * 1.55),
                0,
                1,
              );
        if (severity > 0) {
          const point = {
            x: (pointOnA.x + pointOnB.x) * 0.5,
            y: (pointOnA.y + pointOnB.y) * 0.5,
          };
          if (damageSeverity > 0) {
            const damageTakenA = damageSeverity * damageScaleForZones(zoneA, zoneB);
            const damageTakenB = damageSeverity * damageScaleForZones(zoneB, zoneA);
            const deformationA = applyImpactDamage(
              a,
              pointOnA,
              damageTakenA,
              { x: -normal.x, y: -normal.y },
            );
            const deformationB = applyImpactDamage(
              b,
              pointOnB,
              damageTakenB,
              normal,
            );
            localHulls[i] = getLocalCollisionHull(a);
            localHulls[j] = getLocalCollisionHull(b);
            worldHulls[i] = getWorldCollisionHull(a, localHulls[i]);
            worldHulls[j] = getWorldCollisionHull(b, localHulls[j]);
            const aDisabledByImpact = aActiveAtImpact && a.disabled;
            const bDisabledByImpact = bActiveAtImpact && b.disabled;
            collisions.push({
              aId: a.id,
              bId: b.id,
              aActiveAtImpact,
              bActiveAtImpact,
              aDisabledByImpact,
              bDisabledByImpact,
              point,
              pointA: pointOnA,
              pointB: pointOnB,
              normal,
              severity,
              damageSeverity,
              damageTakenA,
              damageTakenB,
              zoneA,
              zoneB,
              deformationA,
              deformationB,
            });
          } else {
            collisions.push({
              aId: a.id,
              bId: b.id,
              aActiveAtImpact,
              bActiveAtImpact,
              aDisabledByImpact: false,
              bDisabledByImpact: false,
              point,
              pointA: pointOnA,
              pointB: pointOnB,
              normal,
              severity,
              damageSeverity,
              damageTakenA: 0,
              damageTakenB: 0,
              zoneA,
              zoneB,
              deformationA: 0,
              deformationB: 0,
            });
          }
        }
      }
    }
  }

  return collisions;
}
