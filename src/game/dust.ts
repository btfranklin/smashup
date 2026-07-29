import { pseudoRandom } from "./math";
import type { Car, DustPuff, GameState } from "./types";

function createDustPuff(
  state: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number,
  alpha: number,
  tone: number,
): DustPuff {
  return {
    id: state.nextDustPuffId++,
    x,
    y,
    vx,
    vy,
    age: 0,
    ttl: 0.42 + alpha * 0.2,
    size,
    alpha,
    tone,
  };
}

export function updateDustEffects(state: GameState, dt: number): void {
  for (const puff of state.dustPuffs) {
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vx *= Math.pow(0.96, dt * 60);
    puff.vy *= Math.pow(0.96, dt * 60);
    puff.age += dt;
  }
  state.dustPuffs = state.dustPuffs
    .filter((puff) => puff.age < puff.ttl)
    .slice(-180);
}

export function spawnCollisionDust(state: GameState): void {
  for (const collision of state.recentCollisions) {
    if (collision.severity < 0.26) {
      continue;
    }
    const burstCount = collision.severity > 0.72 ? 4 : 2;
    for (let i = 0; i < burstCount; i += 1) {
      const seed =
        collision.point.x * 0.07 +
        collision.point.y * 0.11 +
        i * 17 +
        state.roundTick;
      state.dustPuffs.push(
        createDustPuff(
          state,
          collision.point.x + (pseudoRandom(seed + 1) - 0.5) * 12,
          collision.point.y + (pseudoRandom(seed + 2) - 0.5) * 12,
          collision.normal.x * 24 * collision.severity +
            (pseudoRandom(seed + 3) - 0.5) * 32,
          collision.normal.y * 24 * collision.severity +
            (pseudoRandom(seed + 4) - 0.5) * 32,
          8 + collision.severity * 12,
          0.24 + collision.severity * 0.28,
          0.8 + pseudoRandom(seed + 5) * 0.2,
        ),
      );
    }
  }
}

function spawnWheelDust(
  state: GameState,
  car: Car,
  wheelX: number,
  wheelY: number,
  bias: number,
): void {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const x = car.x + forwardX * wheelX + rightX * wheelY;
  const y = car.y + forwardY * wheelX + rightY * wheelY;
  state.dustPuffs.push(
    createDustPuff(
      state,
      x,
      y,
      -car.vx * 0.08 + rightX * bias,
      -car.vy * 0.08 + rightY * bias,
      6 + car.slipAmount * 0.08,
      0.16 + Math.min(0.24, car.slipAmount * 0.004),
      0.86,
    ),
  );
}

export function spawnSlipDust(state: GameState): void {
  if (state.mode !== "running" && state.mode !== "spectating") {
    return;
  }
  for (const car of state.cars) {
    if (car.disabled || car.slipAmount < 18) {
      continue;
    }
    spawnWheelDust(state, car, 12, -20, -12);
    spawnWheelDust(state, car, 12, 20, 12);
  }
}
