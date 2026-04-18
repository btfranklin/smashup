import { describe, expect, it } from "vitest";

import {
  drawCar,
  getCameraOffset,
  getPhaseColor,
  renderGame,
} from "../src/game/render";
import { createCarPreviewState } from "../src/game/session";
import { createCanvasRecorder } from "./helpers/canvas-recorder";
import { createCarFixture, createRunningState } from "./helpers/fixtures";

describe("render orchestration", () => {
  it("derives phase colors and camera offsets", () => {
    expect(getPhaseColor("healthy", "#123")).toBe("#123");
    expect(getPhaseColor("wounded", "#123")).toBe("#e0c15b");
    expect(getPhaseColor("failing", "#123")).toBe("#ec8c41");
    expect(getPhaseColor("critical", "#123")).toBe("#e24a33");

    expect(
      getCameraOffset({
        tick: 10,
        camera: { shake: 2, nudgeX: 1, nudgeY: -1, freezeTime: 0 },
      }),
    ).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
  });

  it("draws active and disabled cars without throwing", () => {
    const canvas = createCanvasRecorder();
    expect(() =>
      drawCar(canvas.ctx, createCarFixture({ isPlayer: true })),
    ).not.toThrow();
    expect(() =>
      drawCar(canvas.ctx, createCarFixture({ disabled: true }), {
        showPlayerOutline: false,
      }),
    ).not.toThrow();
  });

  it("renders preview mode without HUD and event-feed overlays", () => {
    const canvas = createCanvasRecorder();
    const state = createCarPreviewState("bulldozer", "critical");

    renderGame(canvas.ctx, state);

    const textCalls = canvas
      .find("fillText")
      .map((entry) => String(entry.args[0]));
    expect(textCalls.some((text) => text.includes("Drivers Left"))).toBe(false);
    expect(textCalls.some((text) => text.includes("Round "))).toBe(false);
    expect(canvas.count("scale")).toBeGreaterThan(0);
  });

  it("renders running mode with HUD, event feed, and smoke layered over the arena", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.arena.variant = "junkyard";
    state.arena.objects = [
      {
        id: 1,
        kind: "tire",
        x: 200,
        y: 200,
        vx: 0,
        vy: 0,
        radius: 18,
        mass: 90,
        rotation: 0.2,
        spin: 0,
      },
      {
        id: 2,
        kind: "junk",
        x: 240,
        y: 240,
        vx: 0,
        vy: 0,
        radius: 24,
        mass: 220,
        rotation: 0,
        spin: 0,
      },
    ];
    state.events = [
      { id: 1, text: "Warn", kind: "warning", ttl: 1, emphasis: 1 },
      { id: 2, text: "System", kind: "system", ttl: 1, emphasis: 1 },
      { id: 3, text: "Result", kind: "result", ttl: 1, emphasis: 1 },
    ];
    state.smokePuffs.push({
      id: 1,
      sourceCarId: state.playerId,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      age: 0.1,
      ttl: 1,
      size: 10,
      density: 0.5,
      flame: 0.4,
    });

    renderGame(canvas.ctx, state);

    const textCalls = canvas
      .find("fillText")
      .map((entry) => String(entry.args[0]));
    expect(textCalls.some((text) => text.includes("Drivers Left"))).toBe(true);
    expect(textCalls).toContain("Warn");
    expect(textCalls).toContain("System");
    expect(textCalls).toContain("Result");
    const outlineIndex = canvas.operations.findIndex(
      (entry) => entry.type === "strokeRect",
    );
    const smokeIndex = canvas.operations.findIndex(
      (entry) => entry.type === "createRadialGradient",
    );
    expect(outlineIndex).toBeGreaterThanOrEqual(0);
    expect(smokeIndex).toBeGreaterThan(outlineIndex);
  });

  it("renders intro overlays with the countdown and title", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.mode = "intro";
    state.session.countdown = 2.4;

    renderGame(canvas.ctx, state);

    const textCalls = canvas
      .find("fillText")
      .map((entry) => String(entry.args[0]));
    expect(textCalls).toContain(state.arena.title);
    expect(textCalls).toContain("3");
  });

  it("renders a non-running overlay outside intro", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.mode = "round_results";

    renderGame(canvas.ctx, state);

    expect(canvas.operations.slice(-3).map((entry) => entry.type)).toEqual([
      "save",
      "fillRect",
      "restore",
    ]);
  });

  it("renders mud zones when present in the arena", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.arena.variant = "mud_pit";
    state.arena.mudZones = [
      { id: 1, x: 100, y: 100, width: 200, height: 100, grip: 0.6 },
    ];

    renderGame(canvas.ctx, state);

    expect(canvas.count("createLinearGradient")).toBeGreaterThan(1);
    expect(canvas.count("roundRect")).toBeGreaterThan(1);
  });
});
