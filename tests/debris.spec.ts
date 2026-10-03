import { describe, expect, it } from "vitest";

import {
  getRecentDebrisSummary,
  spawnImpactDebris,
  updateDebrisEffects,
} from "../src/game/debris";
import { createCollisionFixture, createStateFixture } from "./helpers/fixtures";

describe("debris effects", () => {
  it("spawns debris only above the impact threshold", () => {
    const state = createStateFixture({
      recentCollisions: [
        createCollisionFixture({ severity: 0.5 }),
        createCollisionFixture({ severity: 0.7, point: { x: 520, y: 500 } }),
        createCollisionFixture({ severity: 0.95, point: { x: 540, y: 500 } }),
      ],
    });

    spawnImpactDebris(state);

    expect(state.debrisParticles.length).toBeGreaterThan(3);
    expect(state.debrisParticles.length).toBeLessThanOrEqual(220);
  });

  it("ages and prunes debris particles", () => {
    const state = createStateFixture({
      debrisParticles: Array.from({ length: 260 }, (_, index) => ({
        id: index + 1,
        x: 10_000 + index,
        y: -10_000 - index,
        vx: 20,
        vy: -20,
        age: index < 240 ? 0.1 : 1,
        ttl: index < 240 ? 1 : 0.4,
        size: 3,
        rotation: 0,
        spin: 1,
        tone: 0.5,
      })),
    });

    updateDebrisEffects(state, 0.5);

    expect(state.debrisParticles).toHaveLength(220);
    expect(state.debrisParticles[0]?.id).toBe(21);
    expect(state.debrisParticles.at(-1)?.id).toBe(240);
    expect(state.debrisParticles.every((particle) => particle.age < particle.ttl)).toBe(true);
  });

  it("summarizes only the most recent debris with clamped coordinates", () => {
    const state = createStateFixture({
      debrisParticles: Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        x: 20_000 + index,
        y: -20_000 - index,
        vx: 0,
        vy: 0,
        age: 0.1234,
        ttl: 0.4,
        size: 3.456,
        rotation: 0,
        spin: 0,
        tone: 0.5,
      })),
    });

    const summary = getRecentDebrisSummary(state);

    expect(summary).toHaveLength(6);
    expect(summary[0]).toEqual({
      x: 9999,
      y: -9999,
      age: 0.12,
      size: 3.5,
    });
  });
});
