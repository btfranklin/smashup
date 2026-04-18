import { describe, expect, it } from "vitest";

import {
  spawnCollisionDust,
  spawnSlipDust,
  updateDustEffects,
} from "../src/game/dust";
import {
  createCarFixture,
  createCollisionFixture,
  createStateFixture,
} from "./helpers/fixtures";

describe("dust effects", () => {
  it("spawns more collision dust for stronger hits and ignores tiny taps", () => {
    const weak = createCollisionFixture({ severity: 0.2 });
    const medium = createCollisionFixture({ severity: 0.4, point: { x: 510, y: 500 } });
    const strong = createCollisionFixture({ severity: 0.8, point: { x: 520, y: 500 } });
    const state = createStateFixture({
      recentCollisions: [weak, medium, strong],
    });

    spawnCollisionDust(state);

    expect(state.dustPuffs.length).toBe(6);
  });

  it("spawns wheel dust only for slipping active cars during running mode", () => {
    const slider = createCarFixture({
      isPlayer: true,
      slipAmount: 28,
      disabled: false,
    });
    const parked = createCarFixture({ slipAmount: 10 });
    const disabled = createCarFixture({ slipAmount: 30, disabled: true });
    const state = createStateFixture({
      mode: "running",
      cars: [slider, parked, disabled],
      playerId: slider.id,
    });

    spawnSlipDust(state);

    expect(state.dustPuffs).toHaveLength(2);
  });

  it("ages and prunes dust puffs", () => {
    const state = createStateFixture({
      dustPuffs: Array.from({ length: 200 }, (_, index) => ({
        id: index + 1,
        x: 0,
        y: 0,
        vx: 10,
        vy: 10,
        age: index % 2 === 0 ? 0.1 : 1,
        ttl: 0.5,
        size: 10,
        alpha: 0.4,
        tone: 0.8,
      })),
    });

    updateDustEffects(state, 0.5);

    expect(state.dustPuffs.length).toBeLessThanOrEqual(180);
    expect(state.dustPuffs.every((puff) => puff.age < puff.ttl)).toBe(true);
  });
});
