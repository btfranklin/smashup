import { clamp, pseudoRandom } from "./math";
import type { CollisionEvent, DebrisParticle, GameState } from "./types";

const DEBRIS_THRESHOLD = 0.66;

function createDebrisParticle(
  state: GameState,
  collision: CollisionEvent,
  seed: number,
): DebrisParticle {
  const scatter = pseudoRandom(seed + 1) - 0.5;
  const burst = 70 + collision.severity * 150;
  const tangentX = -collision.normal.y;
  const tangentY = collision.normal.x;

  return {
    id: state.nextDebrisParticleId++,
    x: collision.point.x + scatter * 12,
    y: collision.point.y + (pseudoRandom(seed + 2) - 0.5) * 12,
    vx:
      collision.normal.x * (18 + pseudoRandom(seed + 3) * burst) +
      tangentX * scatter * 85,
    vy:
      collision.normal.y * (18 + pseudoRandom(seed + 4) * burst) +
      tangentY * scatter * 85,
    age: 0,
    ttl: 0.26 + pseudoRandom(seed + 5) * 0.28,
    size: 2.4 + pseudoRandom(seed + 6) * (2.4 + collision.severity * 2.8),
    rotation: pseudoRandom(seed + 7) * Math.PI * 2,
    spin: (pseudoRandom(seed + 8) - 0.5) * 10,
    tone: 0.35 + pseudoRandom(seed + 9) * 0.45,
  };
}

export function updateDebrisEffects(state: GameState, dt: number): void {
  for (const particle of state.debrisParticles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.94, dt * 60);
    particle.vy *= Math.pow(0.94, dt * 60);
    particle.rotation += particle.spin * dt;
    particle.age += dt;
  }

  state.debrisParticles = state.debrisParticles
    .filter((particle) => particle.age < particle.ttl)
    .slice(-220);
}

export function spawnImpactDebris(state: GameState): void {
  for (const collision of state.recentCollisions) {
    if (collision.severity < DEBRIS_THRESHOLD) {
      continue;
    }

    const count = Math.round(3 + (collision.severity - DEBRIS_THRESHOLD) * 10);
    for (let index = 0; index < count; index += 1) {
      const seed =
        state.roundTick * 100 +
        collision.aId * 17 +
        collision.bId * 29 +
        index * 13 +
        collision.point.x * 0.11 +
        collision.point.y * 0.07;
      state.debrisParticles.push(createDebrisParticle(state, collision, seed));
    }
  }

  state.debrisParticles = state.debrisParticles.slice(-220);
}

export function getRecentDebrisSummary(state: GameState): Array<{
  x: number;
  y: number;
  age: number;
  size: number;
}> {
  return state.debrisParticles.slice(-6).map((particle) => ({
    x: Number(clamp(particle.x, -9999, 9999).toFixed(1)),
    y: Number(clamp(particle.y, -9999, 9999).toFixed(1)),
    age: Number(particle.age.toFixed(2)),
    size: Number(particle.size.toFixed(1)),
  }));
}
