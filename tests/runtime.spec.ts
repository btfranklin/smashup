import { describe, expect, it } from "vitest";

import {
  advanceState,
  applyPlayerControls,
  pushEvent,
  resetRoundStats,
} from "../src/game/runtime";
import { createCarFixture, createRunningState, createStateFixture, getPlayerFixture } from "./helpers/fixtures";

describe("runtime flow", () => {
  it("caps the event feed and resets round stats", () => {
    const state = createStateFixture();
    for (let index = 0; index < 10; index += 1) {
      pushEvent(state, `event-${index}`, "warning");
    }

    expect(state.events).toHaveLength(8);
    expect(state.events[0]?.text).toBe("event-2");

    state.roundStats.biggestHitSeverity = 1;
    state.roundStats.playerKnockouts.push("Rival");
    resetRoundStats(state);
    expect(state.roundStats.biggestHitSeverity).toBe(0);
    expect(state.roundStats.playerKnockouts).toEqual([]);
    expect(state.roundStats.lastPlayerTargetElapsed).toBeNull();
  });

  it("applies player controls only while running and alive", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);

    applyPlayerControls(state, {
      left: true,
      right: false,
      forward: true,
      reverse: false,
    });
    expect(player.controls).toEqual({ steer: -1, forward: 1, reverse: 0 });

    state.mode = "menu";
    applyPlayerControls(state, {
      left: false,
      right: true,
      forward: false,
      reverse: true,
    });
    expect(player.controls).toEqual({ steer: -1, forward: 1, reverse: 0 });

    state.mode = "running";
    player.disabled = true;
    applyPlayerControls(state, {
      left: false,
      right: true,
      forward: false,
      reverse: true,
    });
    expect(player.controls).toEqual({ steer: -1, forward: 1, reverse: 0 });
  });

  it("expires events and decays camera state outside running mode", () => {
    const state = createStateFixture({
      mode: "menu",
      events: [
        { id: 1, text: "Soon gone", kind: "warning", ttl: 0.1, emphasis: 1 },
      ],
      camera: { shake: 3, nudgeX: 2, nudgeY: 2, freezeTime: 0.3 },
    });

    advanceState(state, 0.2);

    expect(state.events).toEqual([]);
    expect(state.camera.shake).toBeLessThan(3);
    expect(state.camera.freezeTime).toBeLessThan(0.3);
  });

  it("counts down intros into running mode", () => {
    const state = createRunningState();
    state.mode = "intro";
    state.session.countdown = 0.04;
    state.events = [
      { id: 1, text: "Old", kind: "warning", ttl: 1, emphasis: 1 },
    ];

    advanceState(state, 0.1);

    expect(state.mode).toBe("running");
    expect(state.events).toEqual([]);
  });

  it("emits the go cue once when the intro crosses the last second and clears collisions while idle", () => {
    const state = createRunningState();
    state.mode = "intro";
    state.session.countdown = 1.05;
    state.recentCollisions = [
      {
        aId: 1,
        bId: 2,
        point: { x: 0, y: 0 },
        normal: { x: 1, y: 0 },
        severity: 0.9,
        damageSeverity: 0.8,
        zoneA: "front",
        zoneB: "rear",
      },
    ];

    advanceState(state, 0.1);
    advanceState(state, 0.1);
    expect(state.events.filter((event) => event.text === "Go!")).toHaveLength(1);

    state.mode = "upgrade";
    advanceState(state, 0.1);
    expect(state.recentCollisions).toEqual([]);
  });

  it("honors freeze time and skips physics while frozen", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    player.vx = 120;
    state.camera.freezeTime = 0.1;
    const beforeX = player.x;

    advanceState(state, 0.05);

    expect(player.x).toBe(beforeX);
    expect(state.elapsed).toBeGreaterThan(0);
  });

  it("returns immediately for preview states", () => {
    const state = createStateFixture({ mode: "car_preview", elapsed: 10 });
    advanceState(state, 1);
    expect(state.elapsed).toBe(10);
  });

  it("transitions to round results when the player is eliminated", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      disabled: true,
      systems: {
        engine: 0.05,
        radiator: 0.5,
        transmission: 0.5,
        steering: 0.5,
        overheat: 0,
      },
    });
    const rival = createCarFixture({ id: 2, label: "Rimshot" });
    const state = createStateFixture({
      mode: "running",
      cars: [player, rival],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    expect(state.mode).toBe("round_results");
    expect(state.outlastedDriverIds).toEqual([rival.id]);
    expect(state.session.lastRoundSummary?.playerWon).toBe(false);
    expect(state.session.lastRoundSummary?.knockoutReason).toBe("Engine Failure");
  });

  it("registers huge hits, freeze time, and system events from collisions", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({
      id: 50,
      x: player.x + 55,
      y: player.y,
      angle: 0,
      vx: 0,
      vy: 0,
      label: "Rimshot",
    });
    player.vx = 220;
    player.systems.engine = 0.35;
    player.phases.engine = "healthy";
    state.cars = [player, rival];

    advanceState(state, 1 / 60);

    expect(state.camera.shake).toBeGreaterThan(0);
    expect(state.camera.freezeTime).toBeGreaterThanOrEqual(0);
    expect(
      state.events.some(
        (event) =>
          event.kind === "impact" || event.kind === "system",
      ),
    ).toBe(true);
  });

  it("does not call low-damage bumper shoves huge hits", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({
      id: 51,
      x: player.x + 55,
      y: player.y,
      angle: 0,
      vx: 0,
      vy: 0,
      label: "Rimshot",
    });
    player.vx = 100;
    state.cars = [player, rival];

    advanceState(state, 1 / 60);

    expect(state.roundStats.biggestHitSeverity).toBeLessThan(0.48);
    expect(state.camera.shake).toBe(0);
    expect(state.events.some((event) => event.text === "Huge Hit!")).toBe(
      false,
    );
  });

  it("transitions to round results with a win when the player outlasts everyone", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    state.cars = [
      player,
      createCarFixture({ id: 10, disabled: true, eliminationTime: 1 }),
    ];

    advanceState(state, 1 / 60);

    expect(state.mode).toBe("round_results");
    expect(state.winnerId).toBe(player.id);
    expect(state.session.lastRoundSummary?.playerWon).toBe(true);
  });

  it("announces the final two once", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({ id: 20 });
    state.cars = [
      player,
      rival,
      createCarFixture({ id: 21, disabled: true }),
    ];

    advanceState(state, 1 / 60);

    expect(state.roundStats.finalTwoAnnounced).toBe(true);
    expect(state.events.some((event) => event.text.includes("final two"))).toBe(
      true,
    );
  });

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
    state.roundStats.lastPlayerTargetId = rival.id;
    state.roundStats.lastPlayerTargetElapsed = state.elapsed - 1;

    advanceState(state, 1 / 60);

    expect(state.roundStats.playerKnockouts).toContain("Scrapheap");
    expect(state.events.some((event) => event.text.includes("wrecked"))).toBe(
      true,
    );
  });
});
