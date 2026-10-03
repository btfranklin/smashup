import { describe, expect, it } from "vitest";

import { updateSmokeEffects } from "../src/game/smoke";
import { createCarFixture, createStateFixture } from "./helpers/fixtures";

describe("smoke effects", () => {
  it("spawns smoke and flame for critically damaged running cars", () => {
    const car = createCarFixture({
      isPlayer: true,
      disabled: false,
      body: { front: 0.62, rear: 0, left: 0, right: 0 },
      systems: {
        engine: 0.22,
        radiator: 0.24,
        transmission: 0.26,
        steering: 0.7,
        overheat: 0.88,
      },
    });
    const state = createStateFixture({
      mode: "running",
      cars: [car],
      playerId: car.id,
    });

    updateSmokeEffects(state, 1);

    expect(state.smokePuffs.length).toBeGreaterThan(0);
    expect(state.smokePuffs.some((puff) => puff.flame > 0)).toBe(true);
  });

  it("suppresses spawning for disabled cars", () => {
    const car = createCarFixture({
      disabled: true,
      smokeTimer: 2,
      systems: {
        engine: 0.2,
        radiator: 0.2,
        transmission: 0.2,
        steering: 0.5,
        overheat: 0.9,
      },
    });
    const state = createStateFixture({
      mode: "running",
      cars: [car],
      playerId: car.id,
    });

    updateSmokeEffects(state, 1);

    expect(car.smokeTimer).toBe(0);
    expect(state.smokePuffs).toEqual([]);
  });

  it("ages and prunes existing puffs even outside running mode", () => {
    const state = createStateFixture({
      mode: "menu",
      smokePuffs: Array.from({ length: 210 }, (_, index) => ({
        id: index + 1,
        sourceCarId: 1,
        x: index,
        y: index,
        vx: 10,
        vy: 10,
        age: index < 200 ? 0.1 : 10,
        ttl: index < 200 ? 1 : 0.5,
        size: 10,
        density: 0.5,
        flame: 0,
      })),
    });

    updateSmokeEffects(state, 0.5);

    expect(state.smokePuffs).toHaveLength(180);
    expect(state.smokePuffs[0]?.id).toBe(21);
    expect(state.smokePuffs.at(-1)?.id).toBe(200);
    expect(state.smokePuffs.every((puff) => puff.age < puff.ttl)).toBe(true);
  });

  it("caps live puffs after smoke emission and keeps the newest puffs", () => {
    const car = createCarFixture({
      isPlayer: true,
      disabled: false,
      smokeTimer: 0.1,
      body: { front: 0.62, rear: 0, left: 0, right: 0 },
      systems: {
        engine: 0.22,
        radiator: 0.24,
        transmission: 0.26,
        steering: 0.7,
        overheat: 0.88,
      },
    });
    const state = createStateFixture({
      mode: "running",
      cars: [car],
      playerId: car.id,
      smokePuffs: Array.from({ length: 190 }, (_, index) => ({
        id: index + 1,
        sourceCarId: car.id,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: index < 180 ? 0 : 2,
        ttl: 1,
        size: 8,
        density: 0.5,
        flame: 0,
      })),
      nextSmokePuffId: 191,
    });

    updateSmokeEffects(state, 1 / 60);

    expect(state.smokePuffs).toHaveLength(180);
    expect(state.smokePuffs[0]?.id).toBe(2);
    expect(state.smokePuffs.at(-1)?.id).toBe(191);
  });
});
