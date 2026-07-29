import { describe, expect, it } from "vitest";

import { advanceState } from "../src/game/runtime";
import {
  createCarFixture,
  createRunningState,
  createStateFixture,
  getPlayerFixture,
} from "./helpers/fixtures";

describe("runtime collision credit and causality", () => {
  it("records knockout credit when the player disables a rival", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({
      id: 60,
      x: player.x + 55,
      y: player.y,
      angle: 0,
      vx: 0,
      vy: 0,
      label: "Scrapheap",
      systems: {
        engine: 0.12,
        radiator: 0.1,
        transmission: 0.2,
        steering: 0.2,
        overheat: 0.9,
      },
      body: { front: 0.7, rear: 0.1, left: 0, right: 0 },
    });
    player.vx = 220;
    state.cars = [player, rival];

    advanceState(state, 1 / 60);

    expect(state.roundStats.playerKnockouts).toContain("Scrapheap");
    expect(state.events.some((event) => event.text.includes("wrecked"))).toBe(
      true,
    );
  });

  it("records each opponent in simultaneous damaging player contacts", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      x: 500,
      y: 500,
      vx: 220,
      mass: 10_000,
    });
    const firstRival = createCarFixture({
      id: 71,
      label: "First",
      x: 555,
      y: 495,
      vx: -260,
      mass: 500,
    });
    const secondRival = createCarFixture({
      id: 72,
      label: "Second",
      x: 555,
      y: 505,
      mass: 500,
    });
    const survivor = createCarFixture({ id: 73, x: 1_000, y: 700 });
    const state = createStateFixture({
      mode: "running",
      cars: [player, firstRival, secondRival, survivor],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    expect(state.roundStats.playerContactLedger[firstRival.id]).toEqual({
      elapsed: expect.any(Number),
      severity: expect.any(Number),
    });
    expect(state.roundStats.playerContactLedger[secondRival.id]).toEqual({
      elapsed: expect.any(Number),
      severity: expect.any(Number),
    });
  });

  it("stops player credit after an earlier impact wrecks them in the same pileup", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      x: 500,
      y: 500,
      vx: 260,
      mass: 10_000,
      systems: {
        engine: 0.29,
        radiator: 0.29,
        transmission: 0.29,
        steering: 0.29,
        overheat: 0,
      },
      body: { front: 0.17, rear: 0.46, left: 0.46, right: 0.46 },
    });
    const firstRival = createCarFixture({
      id: 71,
      label: "First",
      x: 555,
      y: 495,
      mass: 500,
    });
    const secondRival = createCarFixture({
      id: 72,
      label: "Second",
      x: 555,
      y: 505,
      mass: 500,
    });
    const survivor = createCarFixture({ id: 73, x: 1_000, y: 700 });
    const state = createStateFixture({
      mode: "running",
      cars: [player, firstRival, secondRival, survivor],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    const playerCollisions = state.recentCollisions.filter(
      (collision) =>
        collision.aId === player.id || collision.bId === player.id,
    );
    expect(player.disabled).toBe(true);
    expect(playerCollisions).toHaveLength(2);
    expect(playerCollisions.map((collision) =>
      collision.aId === player.id
        ? collision.aActiveAtImpact
        : collision.bActiveAtImpact,
    )).toEqual([true, false]);
    expect(state.roundStats.playerContactLedger[firstRival.id]).toBeDefined();
    expect(state.roundStats.playerContactLedger[secondRival.id]).toBeUndefined();
    expect(state.roundStats.playerKnockouts).not.toContain(secondRival.label);
  });

  it("keeps the active causal hit when the wrecked rival hulk collides again", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      x: 500,
      y: 500,
      vx: 120,
      mass: 10_000,
    });
    const rival = createCarFixture({
      id: 71,
      label: "Rival",
      x: 555,
      y: 500,
      mass: 500,
      systems: {
        engine: 0.29,
        radiator: 0.29,
        transmission: 0.29,
        steering: 0.29,
        overheat: 0,
      },
      body: { front: 0.19, rear: 0.449, left: 0.46, right: 0.46 },
    });
    const lateCollider = createCarFixture({
      id: 72,
      label: "Late Collider",
      x: 610,
      y: 540,
      vx: 0,
      vy: -500,
      mass: 10_000,
    });
    const survivor = createCarFixture({ id: 73, x: 1_000, y: 700 });
    const state = createStateFixture({
      mode: "running",
      cars: [player, rival, lateCollider, survivor],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    const rivalCollisions = state.recentCollisions.filter(
      (collision) =>
        collision.aId === rival.id || collision.bId === rival.id,
    );
    expect(rival.disabled).toBe(true);
    expect(rivalCollisions).toHaveLength(2);
    expect(
      rivalCollisions.map((collision) =>
        collision.aId === rival.id
          ? collision.aActiveAtImpact
          : collision.bActiveAtImpact,
      ),
    ).toEqual([true, false]);
    expect(rivalCollisions[1].damageSeverity).toBeGreaterThan(
      rivalCollisions[0].damageSeverity,
    );
    expect(state.roundStats.playerKnockouts).toContain(rival.label);
  });

  it("attributes a wreck to the weaker collision that actually disables the car", () => {
    const firstAttacker = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      x: 445,
      y: 500,
      vx: 220,
      mass: 500,
    });
    const victim = createCarFixture({
      id: 71,
      label: "Rival",
      x: 500,
      y: 500,
      mass: 10_000,
      systems: {
        engine: 0.29,
        radiator: 0.29,
        transmission: 0.29,
        steering: 0.29,
        overheat: 0,
      },
      body: { front: 0.19, rear: 0, left: 0, right: 0 },
    });
    const disablingAttacker = createCarFixture({
      id: 72,
      label: "Finisher",
      x: 555,
      y: 500,
      angle: Math.PI,
      vx: -110,
      mass: 500,
    });
    const survivor = createCarFixture({ id: 73, x: 1_000, y: 700 });
    const state = createRunningState();
    state.cars = [firstAttacker, victim, disablingAttacker, survivor];
    state.playerId = firstAttacker.id;

    advanceState(state, 1 / 60);

    const victimCollisions = state.recentCollisions.filter(
      (collision) =>
        collision.aId === victim.id || collision.bId === victim.id,
    );
    const causalCollision = victimCollisions.find((collision) =>
      collision.aId === victim.id
        ? collision.aDisabledByImpact
        : collision.bDisabledByImpact,
    );

    expect(victim.disabled).toBe(true);
    expect(victimCollisions).toHaveLength(2);
    expect(victimCollisions[0].damageSeverity).toBeGreaterThan(
      victimCollisions[1].damageSeverity,
    );
    expect(
      victimCollisions.map((collision) =>
        collision.aId === victim.id
          ? collision.aActiveAtImpact
          : collision.bActiveAtImpact,
      ),
    ).toEqual([true, true]);
    expect(
      victimCollisions.map((collision) =>
        collision.aId === victim.id
          ? collision.aDisabledByImpact
          : collision.bDisabledByImpact,
      ),
    ).toEqual([false, true]);
    expect(causalCollision).toBe(victimCollisions[1]);
    expect(state.roundStats.playerKnockouts).not.toContain(victim.label);
    expect(
      state.events.some((event) => event.text === `${victim.label} is done`),
    ).toBe(true);
  });

  it("does not credit a disabled player hulk for later collisions", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      x: 500,
      y: 500,
      disabled: true,
      eliminationTime: 1,
    });
    const rival = createCarFixture({
      id: 81,
      label: "Rimshot",
      x: 555,
      y: 500,
      angle: Math.PI,
      vx: -220,
      systems: {
        engine: 0.55,
        radiator: 0.55,
        transmission: 0.55,
        steering: 0.55,
        overheat: 0,
      },
      body: { front: 0.3, rear: 0, left: 0, right: 0 },
    });
    const survivor = createCarFixture({ id: 82, x: 1_000, y: 700 });
    const state = createStateFixture({
      mode: "spectating",
      sessionElapsed: 10,
      cars: [player, rival, survivor],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    expect(rival.disabled).toBe(true);
    expect(state.roundStats.playerContactLedger[rival.id]).toBeUndefined();
    expect(state.roundStats.playerKnockouts).toEqual([]);
    expect(
      state.events.some((event) => event.text === "You wrecked Rimshot"),
    ).toBe(false);
  });

  it("credits delayed knockouts from recent player damage", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({
      id: 61,
      x: player.x + 300,
      y: player.y,
      label: "Scrapheap",
      systems: {
        engine: 0.08,
        radiator: 0.02,
        transmission: 0.2,
        steering: 0.2,
        overheat: 1,
      },
      body: { front: 0.5, rear: 0.2, left: 0.1, right: 0.1 },
    });
    state.cars = [player, rival];
    state.roundStats.playerContactLedger[rival.id] = {
      elapsed: state.sessionElapsed - 1,
      severity: 0.76,
    };

    advanceState(state, 1 / 60);

    expect(state.roundStats.playerKnockouts).toContain("Scrapheap");
    expect(state.roundStats.strongestPlayerKnockoutSeverity).toBe(0.76);
    expect(state.session.lastRoundSummary?.awardIds).toContain("sledgehammer");
    expect(state.events.some((event) => event.text.includes("wrecked"))).toBe(
      true,
    );
  });

  it("keeps delayed credit eligible through exactly four seconds", () => {
    function runAt(stepEndElapsed: number) {
      const player = createCarFixture({
        id: 1,
        isPlayer: true,
        label: "Player",
      });
      const rival = createCarFixture({
        id: 2,
        label: "Rival",
        systems: {
          engine: 0.9,
          radiator: 0.9,
          transmission: 0.9,
          steering: 0.9,
          overheat: 1,
        },
      });
      const survivor = createCarFixture({ id: 3, x: 1_000, y: 700 });
      const dt = 1 / 60;
      const state = createStateFixture({
        mode: "running",
        sessionElapsed: stepEndElapsed - dt,
        cars: [player, rival, survivor],
        playerId: player.id,
      });
      state.roundStats.playerContactLedger[rival.id] = {
        elapsed: 10,
        severity: 0.74,
      };

      advanceState(state, dt);
      return state.roundStats.playerKnockouts;
    }

    expect(runAt(14)).toContain("Rival");
    expect(runAt(14 + 1 / 60)).not.toContain("Rival");
  });
});
