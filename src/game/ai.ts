import { AI_ARCHETYPE_CONFIG } from "./content";
import { getEngineHealth } from "./damage";
import { clamp, normalizeAngle } from "./math";
import type { Car } from "./types";

export function updateAi(
  car: Car,
  cars: Car[],
  arenaWidth: number,
  arenaHeight: number,
  wallPadding: number,
  dt: number,
): void {
  if (car.disabled) {
    car.controls = { steer: 0, forward: 0, reverse: 0 };
    return;
  }

  const profile = car.aiArchetype ? AI_ARCHETYPE_CONFIG[car.aiArchetype] : AI_ARCHETYPE_CONFIG.bruiser;

  const obstacles = cars.filter((candidate) => candidate.id !== car.id);
  const rivals = obstacles.filter((candidate) => !candidate.disabled);
  const pack = rivals.reduce(
    (acc, candidate) => {
      acc.x += candidate.x;
      acc.y += candidate.y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  const packCenter =
    rivals.length > 0
      ? { x: pack.x / rivals.length, y: pack.y / rivals.length }
      : { x: arenaWidth * 0.5, y: arenaHeight * 0.5 };
  const reverseForwardX = -Math.cos(car.angle);
  const reverseForwardY = -Math.sin(car.angle);

  let target: Car | null = null;
  let bestScore = -Infinity;

  for (const candidate of rivals) {
    const dx = candidate.x - car.x;
    const dy = candidate.y - car.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      continue;
    }

    const toTargetX = dx / distance;
    const toTargetY = dy / distance;
    const reverseAlignment = reverseForwardX * toTargetX + reverseForwardY * toTargetY;
    const targetFacingScore =
      Math.cos(candidate.angle) * -toTargetX + Math.sin(candidate.angle) * -toTargetY;
    const sideOpenness = 1 - Math.abs(targetFacingScore);
    const exposure = Math.max(0, targetFacingScore) * 0.8 + sideOpenness * 0.45;
    const distanceScore = 1 / Math.max(distance, 80);
    const woundedScore = clamp((0.82 - getEngineHealth(candidate)) / 0.42, 0, 1);
    const score =
      reverseAlignment * 1.3 * profile.targetBias +
      exposure * 1.2 * profile.exposureBias +
      distanceScore * 120 +
      woundedScore * 0.9 * profile.woundedBias;

    if (score > bestScore) {
      bestScore = score;
      target = candidate;
    }
  }

  car.aiState.targetId = target?.id ?? null;

  let seekX = reverseForwardX;
  let seekY = reverseForwardY;
  if (target) {
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const distance = Math.hypot(dx, dy) || 1;
    seekX = dx / distance;
    seekY = dy / distance;
  } else {
    const dx = packCenter.x - car.x;
    const dy = packCenter.y - car.y;
    const distance = Math.hypot(dx, dy) || 1;
    seekX = dx / distance;
    seekY = dy / distance;
  }

  let separationX = 0;
  let separationY = 0;
  let localCrowding = 0;
  for (const candidate of obstacles) {
    const dx = car.x - candidate.x;
    const dy = car.y - candidate.y;
    const distance = Math.hypot(dx, dy);
    const influenceRadius = candidate.disabled ? 280 : 260;
    if (distance > 0 && distance < influenceRadius) {
      const scale = (influenceRadius - distance) / influenceRadius;
      separationX += (dx / distance) * scale;
      separationY += (dy / distance) * scale;
      localCrowding += candidate.disabled ? scale * 1.25 : scale;
    }
  }

  const wallMargin = wallPadding + 144;
  let wallX = 0;
  let wallY = 0;
  if (car.x < wallMargin) {
    wallX += (wallMargin - car.x) / wallMargin;
  }
  if (car.x > arenaWidth - wallMargin) {
    wallX -= (car.x - (arenaWidth - wallMargin)) / wallMargin;
  }
  if (car.y < wallMargin) {
    wallY += (wallMargin - car.y) / wallMargin;
  }
  if (car.y > arenaHeight - wallMargin) {
    wallY -= (car.y - (arenaHeight - wallMargin)) / wallMargin;
  }

  const toPackX = packCenter.x - car.x;
  const toPackY = packCenter.y - car.y;
  const packDistance = Math.hypot(toPackX, toPackY) || 1;
  const packPullX = toPackX / packDistance;
  const packPullY = toPackY / packDistance;
  const packWeight = (packDistance > 300 ? 1.1 : 0.28) * profile.packBias;

  const nearestWallDistance = Math.min(
    car.x - wallPadding,
    arenaWidth - wallPadding - car.x,
    car.y - wallPadding,
    arenaHeight - wallPadding - car.y,
  );
  const playableMinX = wallPadding + car.length * 0.5;
  const playableMaxX = arenaWidth - wallPadding - car.length * 0.5;
  const playableMinY = wallPadding + car.width * 0.5;
  const playableMaxY = arenaHeight - wallPadding - car.width * 0.5;
  const boundaryClearances = [
    { clearance: car.x - playableMinX, normalX: 1, normalY: 0 },
    { clearance: playableMaxX - car.x, normalX: -1, normalY: 0 },
    { clearance: car.y - playableMinY, normalX: 0, normalY: 1 },
    { clearance: playableMaxY - car.y, normalX: 0, normalY: -1 },
  ];
  boundaryClearances.sort((a, b) => a.clearance - b.clearance);
  const nearestBoundary = boundaryClearances[0];
  const clearanceTarget = 118;
  let escapeVectorX = 0;
  let escapeVectorY = 0;
  let worstBoundaryPressure = 0;
  let pressuredBoundaries = 0;
  for (const boundary of boundaryClearances) {
    const pressure =
      boundary.clearance < 0
        ? 1 + Math.min(1, -boundary.clearance / 40)
        : clamp((clearanceTarget - boundary.clearance) / clearanceTarget, 0, 1);
    if (pressure <= 0) {
      continue;
    }
    escapeVectorX += boundary.normalX * pressure;
    escapeVectorY += boundary.normalY * pressure;
    worstBoundaryPressure = Math.max(worstBoundaryPressure, pressure);
    pressuredBoundaries += 1;
  }
  if (Math.abs(escapeVectorX) < 0.001 && Math.abs(escapeVectorY) < 0.001) {
    escapeVectorX = nearestBoundary.normalX;
    escapeVectorY = nearestBoundary.normalY;
  }
  const boundaryDanger = clamp(worstBoundaryPressure, 0, 1);
  const cornered = pressuredBoundaries >= 2;
  const wallEscapeWeight =
    (nearestWallDistance < 80 ? 3.3 : nearestWallDistance < 150 ? 1.95 : 0.72) *
    profile.wallEscapeBias;
  const crowdWeight = (localCrowding > 1.2 ? 1.7 : 0.9) / profile.crowdTolerance;
  const targetWeight = (target ? 1.9 : 1.15) * profile.targetBias;

  const desiredX =
    seekX * targetWeight +
    separationX * crowdWeight +
    wallX * wallEscapeWeight +
    packPullX * packWeight;
  const desiredY =
    seekY * targetWeight +
    separationY * crowdWeight +
    wallY * wallEscapeWeight +
    packPullY * packWeight;
  const reverseHeading = Math.atan2(desiredY, desiredX) + Math.PI;
  const headingError = normalizeAngle(reverseHeading - car.angle);

  const speed = Math.hypot(car.vx, car.vy);
  const noseForwardX = Math.cos(car.angle);
  const noseForwardY = Math.sin(car.angle);
  const forwardSpeed = car.vx * noseForwardX + car.vy * noseForwardY;
  const signedTravel = Math.abs(forwardSpeed) > 2 ? Math.sign(forwardSpeed) : 0;
  const nearWall =
    car.x < wallPadding + 46 ||
    car.x > arenaWidth - wallPadding - 46 ||
    car.y < wallPadding + 46 ||
    car.y > arenaHeight - wallPadding - 46;

  if (
    boundaryDanger > 0.16 * profile.wallEscapeBias ||
    (nearWall && speed < 42) ||
    (speed < 32 && Math.abs(headingError) > 2.2) ||
    localCrowding > 1.8 / profile.crowdTolerance
  ) {
    car.aiState.jamTimer += dt;
  } else {
    car.aiState.jamTimer = Math.max(0, car.aiState.jamTimer - dt * 1.6);
  }

  if (boundaryDanger > 0.58 || (cornered && boundaryDanger > 0.32)) {
    car.aiState.resetTimer = Math.max(
      car.aiState.resetTimer,
      (cornered ? 2.1 : 1.8) * profile.jamBias,
    );
    car.aiState.jamTimer = 0;
  } else if (car.aiState.jamTimer > 0.4 * profile.jamBias) {
    car.aiState.resetTimer = 1.45 * profile.jamBias;
    car.aiState.jamTimer = 0;
  }

  if (boundaryDanger > 0.06 || car.aiState.resetTimer > 0) {
    car.aiState.resetTimer = Math.max(0, car.aiState.resetTimer - dt);
    const inwardHeading = Math.atan2(escapeVectorY, escapeVectorX);
    const forwardEscapeError = normalizeAngle(inwardHeading - car.angle);
    const reverseEscapeHeading = normalizeAngle(inwardHeading + Math.PI);
    const reverseEscapeError = normalizeAngle(reverseEscapeHeading - car.angle);
    const preferForward =
      boundaryDanger > 0.58 ||
      cornered ||
      Math.abs(forwardEscapeError) <= Math.abs(reverseEscapeError) + 0.18;

    if (preferForward) {
      car.controls.forward = boundaryDanger > 0.58 ? 1 : 0.92;
      car.controls.reverse = 0;
      car.controls.steer = clamp(forwardEscapeError / 0.95, -1, 1);
    } else {
      car.controls.forward = 0;
      car.controls.reverse = boundaryDanger > 0.58 ? 1 : 0.88;
      car.controls.steer = clamp(reverseEscapeError / 0.95, -1, 1);
    }
    return;
  }

  car.controls.reverse = clamp(
    (0.82 + Math.max(0, bestScore) * 0.08) * profile.reverseAggression,
    0.58,
    1,
  );
  car.controls.forward = 0;
  const leadCompensation = signedTravel <= 0 ? 0.16 : -0.1;
  car.controls.steer = clamp(-(headingError + leadCompensation * Math.sign(headingError)) / 1.7, -1, 1);
}
