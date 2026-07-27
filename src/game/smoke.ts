import { getEngineHealth } from "./damage";
import { clamp01, pseudoRandom, signedSpeedForCar } from "./math";
import type { Car, GameState, SmokePuff } from "./types";

type SmokeProfile = {
  intensity: number;
  darkness: number;
  flame: number;
};

function getSmokeProfile(car: Car): SmokeProfile {
  if (car.disabled) {
    return { intensity: 0, darkness: 0, flame: 0 };
  }

  const enginePressure = clamp01((0.88 - getEngineHealth(car)) / 0.34);
  const drivetrainPressure =
    clamp01((0.92 - car.systems.engine) / 0.3) * 0.96 +
    clamp01((0.94 - car.systems.radiator) / 0.34) * 0.8 +
    clamp01((0.9 - car.systems.transmission) / 0.28) * 0.58;
  const frontPressure = clamp01((car.body.front - 0.03) / 0.24);
  const overheatPressure = clamp01((car.systems.overheat - 0.04) / 0.32);
  const intensity = clamp01(
    Math.max(
      enginePressure,
      drivetrainPressure * 0.96 + frontPressure * 0.08,
      frontPressure * 0.66 + overheatPressure * 0.7,
    ),
  );
  const darkness = clamp01(
    intensity * 0.48 + drivetrainPressure * 0.42 + frontPressure * 0.22,
  );
  const flame = clamp01(
    Math.max(
      (0.54 - getEngineHealth(car)) / 0.14,
      (0.42 - car.systems.engine) / 0.14,
      (0.38 - car.systems.radiator) / 0.12,
      (0.4 - car.systems.transmission) / 0.12,
      (car.systems.overheat - 0.66) / 0.18,
      (car.body.front - 0.52) / 0.18,
    ),
  );
  return { intensity, darkness, flame };
}

function createSmokePuff(state: GameState, car: Car): SmokePuff {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const hoodDistance = car.length * 0.42;
  const seedBase = car.id * 1000 + car.smokeBurstCount * 17 + state.tick * 0.37;
  const lateralOffset = (pseudoRandom(seedBase + 1) - 0.5) * 14;
  const x = car.x + forwardX * hoodDistance + rightX * lateralOffset;
  const y = car.y + forwardY * hoodDistance + rightY * lateralOffset;
  const profile = getSmokeProfile(car);
  const intensity = profile.intensity;
  const motionBleed = 0.08 + intensity * 0.08;

  car.smokeBurstCount += 1;

  return {
    id: state.nextSmokePuffId++,
    sourceCarId: car.id,
    x,
    y,
    vx: -car.vx * motionBleed + (pseudoRandom(seedBase + 2) - 0.5) * 12,
    vy: -car.vy * motionBleed + (pseudoRandom(seedBase + 3) - 0.5) * 12,
    age: 0,
    ttl: 0.75 + intensity * 0.25 + pseudoRandom(seedBase + 4) * 0.45,
    size: 8 + intensity * 9 + pseudoRandom(seedBase + 5) * 4,
    density: profile.darkness,
    flame: profile.flame,
  };
}

export function updateSmokeEffects(state: GameState, dt: number): void {
  for (const puff of state.smokePuffs) {
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vx *= Math.pow(0.985, dt * 60);
    puff.vy *= Math.pow(0.985, dt * 60);
    puff.age += dt;
  }
  state.smokePuffs = state.smokePuffs
    .filter((puff) => puff.age < puff.ttl)
    .slice(-180);

  if (state.mode !== "running" && state.mode !== "spectating") {
    return;
  }

  for (const car of state.cars) {
    const profile = getSmokeProfile(car);
    const intensity = profile.intensity;
    if (intensity <= 0) {
      car.smokeTimer = 0;
      continue;
    }

    const speedFactor = clamp01(
      Math.abs(signedSpeedForCar(car)) / Math.max(car.forwardMaxSpeed, 1),
    );
    const spawnInterval =
      0.34 - intensity * 0.19 - profile.flame * 0.05 - speedFactor * 0.05;
    car.smokeTimer += dt;
    while (car.smokeTimer >= spawnInterval) {
      car.smokeTimer -= spawnInterval;
      state.smokePuffs.push(createSmokePuff(state, car));
    }
  }
}
