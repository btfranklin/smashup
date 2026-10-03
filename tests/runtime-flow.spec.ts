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

describe("runtime flow and system events", () => {
  it.each([
    { side: "left", x: 100, otherX: 180, vx: -100, angle: 0 },
    {
      side: "right",
      x: 1_400,
      otherX: 1_320,
      vx: 100,
      angle: Math.PI,
    },
  ])("contains cars after car contact at the $side wall", (scenario) => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      x: scenario.x,
      y: 450,
      angle: scenario.angle,
    });
    const rival = createCarFixture({
      id: 2,
      x: scenario.otherX,
      y: 450,
      vx: scenario.vx,
      disabled: true,
    });
    const state = createStateFixture({
      mode: "running",
      cars: [player, rival],
      playerId: player.id,
    });

    advanceState(state, 1 / 60);

    const worldX = player.frame.vertices.map(
      (vertex) =>
        player.x +
        vertex.x * Math.cos(player.angle) -
        vertex.y * Math.sin(player.angle),
    );
    const edge =
      scenario.side === "left" ? Math.min(...worldX) : Math.max(...worldX);
    const wall =
      scenario.side === "left"
        ? state.arena.wallPadding
        : state.arena.width - state.arena.wallPadding;
    expect(state.recentCollisions).toHaveLength(1);
    const [collision] = state.recentCollisions;
    expect(collision.aActiveAtImpact).toBe(true);
    expect(collision.bActiveAtImpact).toBe(false);
    expect(collision.aDisabledByImpact).toBe(false);
    expect(collision.bDisabledByImpact).toBe(false);
    expect(collision.point).toEqual({
      x: (collision.pointA.x + collision.pointB.x) * 0.5,
      y: (collision.pointA.y + collision.pointB.y) * 0.5,
    });
    expect(
      scenario.side === "left" ? edge - wall : wall - edge,
    ).toBeGreaterThanOrEqual(-1e-8);
  });

  it.each([
    { side: "left", x: 100, objectX: 142, angle: 0 },
    { side: "right", x: 1_400, objectX: 1_358, angle: Math.PI },
  ])("contains cars after arena-object contact at the $side wall", (scenario) => {
    const player = createCarFixture({
      id: 1,
      isPlayer: true,
      x: scenario.x,
      y: 450,
      angle: scenario.angle,
    });
    const state = createStateFixture({
      mode: "running",
      cars: [player],
      playerId: player.id,
    });
    state.arena.objects = [
      {
        id: 1,
        kind: "junk",
        x: scenario.objectX,
        y: 450,
        vx: 0,
        vy: 0,
        radius: 18,
        mass: 1,
        rotation: 0,
        spin: 0,
      },
    ];

    advanceState(state, 1 / 60);

    const worldX = player.frame.vertices.map(
      (vertex) =>
        player.x +
        vertex.x * Math.cos(player.angle) -
        vertex.y * Math.sin(player.angle),
    );
    const edge =
      scenario.side === "left" ? Math.min(...worldX) : Math.max(...worldX);
    const wall =
      scenario.side === "left"
        ? state.arena.wallPadding
        : state.arena.width - state.arena.wallPadding;
    expect(
      scenario.side === "left" ? edge - wall : wall - edge,
    ).toBeGreaterThanOrEqual(-1e-8);
  });

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
    expect(state.sessionElapsed).toBeGreaterThan(0);
  });

  it("returns immediately for preview states", () => {
    const state = createStateFixture({
      mode: "car_preview",
      sessionElapsed: 10,
    });
    advanceState(state, 1);
    expect(state.sessionElapsed).toBe(10);
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

    const spectatingTick = state.roundTick;
    advanceState(state, 1 / 60);
    expect(state.mode).toBe("spectating");
    expect(state.roundTick).toBe(spectatingTick + 1);

    rival.disabled = true;
    rival.eliminationTime = state.sessionElapsed + 1;
    secondRival.disabled = true;
    secondRival.eliminationTime = state.sessionElapsed + 2;
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
      sessionElapsed: 50,
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

    state.sessionElapsed = 80;
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
      sessionElapsed: 20,
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
      sessionElapsed: 12,
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
});
