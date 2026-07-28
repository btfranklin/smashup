import { describe, expect, it } from "vitest";

import {
  advanceState,
  applyPlayerControls,
  finishSpectatingRound,
} from "../src/game/runtime";
import {
  createCarFixture,
  createRunningState,
  createStateFixture,
  getPlayerFixture,
} from "./helpers/fixtures";

describe("runtime flow", () => {
  it("fails clearly when an active runtime mode has no round plan", () => {
    const player = createCarFixture({ id: 1, isPlayer: true });
    const state = createStateFixture({
      mode: "running",
      currentRoundPlan: null,
      cars: [player],
      playerId: player.id,
    });
    const beforeAdvance = structuredClone(state);

    expect(() => advanceState(state, 1 / 60)).toThrow(
      'Mode "running" requires an active Career Night round.',
    );
    expect(state).toEqual(beforeAdvance);

    state.mode = "spectating";
    const beforeCompletion = structuredClone(state);
    expect(() => finishSpectatingRound(state)).toThrow(
      'Mode "spectating" requires an active Career Night round.',
    );
    expect(state).toEqual(beforeCompletion);
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
        aActiveAtImpact: true,
        bActiveAtImpact: true,
        aDisabledByImpact: false,
        bDisabledByImpact: false,
        point: { x: 0, y: 0 },
        pointA: { x: -6, y: 0 },
        pointB: { x: 6, y: 0 },
        normal: { x: 1, y: 0 },
        severity: 0.9,
        damageSeverity: 0.8,
        damageTakenA: 0.3,
        damageTakenB: 0.8,
        zoneA: "front",
        zoneB: "rear",
        deformationA: 0.08,
        deformationB: 0.09,
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

  it("keeps the round live in spectating mode after the player is eliminated", () => {
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
    const rival = createCarFixture({ id: 2, label: "Rimshot", x: 700 });
    const secondRival = createCarFixture({
      id: 3,
      label: "Rustline",
      x: 900,
    });
    const state = createStateFixture({
      mode: "running",
      cars: [player, rival, secondRival],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    expect(state.mode).toBe("spectating");
    expect(state.outlastedDriverIds).toEqual([rival.id, secondRival.id]);
    expect(state.session.lastRoundSummary).toBeNull();

    const spectatingTick = state.tick;
    advanceState(state, 1 / 60);
    expect(state.mode).toBe("spectating");
    expect(state.tick).toBe(spectatingTick + 1);

    rival.disabled = true;
    rival.eliminationTime = state.elapsed + 1;
    secondRival.disabled = true;
    secondRival.eliminationTime = state.elapsed + 2;
    advanceState(state, 1 / 60);

    expect(state.mode).toBe("round_results");
    expect(state.session.lastRoundSummary?.playerWon).toBe(false);
    expect(state.session.lastRoundSummary?.knockoutReason).toBe(
      "Engine Failure",
    );
    expect(state.session.lastRoundSummary?.placements).toHaveLength(3);
  });

  it("condition-ranks active cars when a spectated round ends early", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      disabled: true,
      eliminationTime: 1,
    });
    const healthy = createCarFixture({ id: 2, label: "Healthy" });
    const battered = createCarFixture({
      id: 3,
      label: "Battered",
      systems: {
        engine: 0.3,
        radiator: 0.3,
        transmission: 0.3,
        steering: 0.3,
        overheat: 0.8,
      },
      body: { front: 0.8, rear: 0.7, left: 0.6, right: 0.5 },
    });
    const state = createStateFixture({
      mode: "spectating",
      cars: [player, battered, healthy],
      playerId: player.id,
    });

    finishSpectatingRound(state);

    expect(state.mode).toBe("round_results");
    expect(state.winnerId).toBe(healthy.id);
    expect(
      state.session.lastRoundSummary?.placements.map(
        (placement) => placement.driverId,
      ),
    ).toEqual([healthy.id, battered.id, player.id]);
  });

  it("measures survival from green to the player wreck, excluding intro and spectating", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      x: 300,
    });
    const rival = createCarFixture({ id: 2, x: 700 });
    const secondRival = createCarFixture({ id: 3, x: 1_100 });
    const state = createStateFixture({
      mode: "intro",
      elapsed: 50,
      cars: [player, rival, secondRival],
      playerId: player.id,
    });
    state.session.countdown = 0.1;

    advanceState(state, 0.1);
    expect(state.mode).toBe("running");
    expect(state.roundStats.startElapsed).toBeCloseTo(50.1);

    player.disabled = true;
    player.systems.engine = 0.05;
    advanceState(state, 0.5);
    expect(state.mode).toBe("spectating");
    expect(player.eliminationTime).toBeCloseTo(50.6);

    state.elapsed = 80;
    finishSpectatingRound(state);

    expect(state.session.lastRoundSummary).toMatchObject({
      playerWrecked: true,
      survivalTime: 0.5,
    });
  });

  it("ends a surviving player's timer at exact round completion", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
    });
    const rival = createCarFixture({
      id: 2,
      label: "Rival",
      disabled: true,
      eliminationTime: 19,
    });
    const state = createStateFixture({
      mode: "running",
      elapsed: 20,
      cars: [player, rival],
      playerId: player.id,
    });
    state.roundStats.startElapsed = 17.25;

    advanceState(state, 0.5);

    expect(state.session.lastRoundSummary).toMatchObject({
      playerWon: true,
      playerWrecked: false,
      survivalTime: 3.3,
    });
  });

  it("awards Survival to a wrecked player ranked first in an all-disabled finish", () => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      label: "Player",
      disabled: true,
      eliminationTime: 12,
    });
    const rival = createCarFixture({
      id: 2,
      label: "Rival",
      disabled: true,
      eliminationTime: 11,
    });
    const state = createStateFixture({
      mode: "running",
      elapsed: 12,
      cars: [player, rival],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    expect(state.session.lastRoundSummary).toMatchObject({
      playerWon: true,
      playerWrecked: true,
      awardIds: expect.arrayContaining(["last_car_rolling"]),
    });
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

  it("emits a player phase transition once without caching phases on the car", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    player.systems.engine = 0.35;
    state.cars = [
      player,
      createCarFixture({ id: 50, x: 1_200, y: 700 }),
    ];

    advanceState(state, 1 / 60);
    const firstSystemEventCount = state.events.filter(
      (event) => event.kind === "system",
    ).length;
    advanceState(state, 1 / 60);

    expect(firstSystemEventCount).toBe(1);
    expect(
      state.events.filter((event) => event.kind === "system"),
    ).toHaveLength(1);
    expect("phases" in player).toBe(false);
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
    expect(state.session.lastRoundSummary?.awardIds).toContain(
      "last_car_rolling",
    );
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

    const finalTwoEvents = state.events.filter((event) =>
      event.text.includes("final two"),
    ).length;
    advanceState(state, 1 / 60);
    expect(
      state.events.filter((event) => event.text.includes("final two")),
    ).toHaveLength(finalTwoEvents);
  });

  it("announces field eliminations without player credit", () => {
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({
      id: 62,
      x: player.x + 300,
      y: player.y,
      label: "Scrapheap",
      systems: {
        engine: 0.04,
        radiator: 0.5,
        transmission: 0.5,
        steering: 0.5,
        overheat: 0,
      },
    });
    state.cars = [player, rival];

    advanceState(state, 1 / 60);

    expect(state.roundStats.playerKnockouts).toEqual([]);
    expect(state.events.some((event) => event.text === "Scrapheap is done")).toBe(
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
      elapsed: 10,
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
      elapsed: state.elapsed - 1,
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
        elapsed: stepEndElapsed - dt,
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
