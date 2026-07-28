import { describe, expect, it } from "vitest";

import {
  drawCar,
  getCameraOffset,
  getPhaseColor,
  renderGame,
} from "../src/game/render";
import {
  drawCarFragments,
  drawSmokePuffs,
} from "../src/game/render/effects";
import { createCarPreviewState } from "../src/game/session";
import {
  createCanvasRecorder,
  RecordedPath2D,
} from "./helpers/canvas-recorder";
import {
  createCarFixture,
  createRunningState,
  createSaturatedRenderState,
} from "./helpers/fixtures";

function getRoundPlan(state: ReturnType<typeof createRunningState>) {
  const plan = state.currentRoundPlan;
  if (!plan) {
    throw new Error("Running render fixture is missing its round plan.");
  }
  return plan;
}

describe("Canvas command orchestration", () => {
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

  it("emits car commands for active and disabled states without throwing", () => {
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

  it("reuses one body path per car and skips disabled body gradients", () => {
    const activeCanvas = createCanvasRecorder();
    const activeCar = createCarFixture({ isPlayer: true });

    drawCar(activeCanvas.ctx, activeCar);

    const bodyPath = activeCanvas
      .paths("fill")
      .find(
        (path) =>
          path.operations.filter((operation) => operation.type === "lineTo")
            .length ===
          activeCar.frame.vertices.length - 1,
      );
    expect(bodyPath).toBeDefined();
    expect(
      activeCanvas
        .paths()
        .filter((path) => path === bodyPath),
    ).toHaveLength(4);
    expect(activeCanvas.count("clip")).toBe(2);
    expect(activeCanvas.count("createLinearGradient")).toBe(1);

    const disabledCanvas = createCanvasRecorder();
    drawCar(
      disabledCanvas.ctx,
      createCarFixture({ disabled: true, isPlayer: false }),
      { showPlayerOutline: false },
    );

    expect(disabledCanvas.count("createLinearGradient")).toBe(0);
  });

  it("keeps body clipping within the damaged-car structural budget", () => {
    const canvas = createCanvasRecorder();
    const car = createCarFixture({
      body: { front: 0.7, rear: 0.6, left: 0.5, right: 0.4 },
    });
    car.frame.crush = {
      front: 0.4,
      rear: 0.4,
      left: 0.3,
      right: 0.3,
    };
    car.frame.scars = [
      {
        id: 1,
        x: 4,
        y: 2,
        angle: 0.4,
        length: 8,
        depth: 0.7,
        width: 2,
      },
    ];

    drawCar(canvas.ctx, car, { showPlayerOutline: false });

    expect(canvas.count("clip")).toBe(4);
  });

  it("draws a distinct character line for each car preset", () => {
    const cases = [
      {
        presetId: "bulldozer" as const,
        expectedStart: (length: number) => [length * 0.2, -6],
      },
      {
        presetId: "darter" as const,
        expectedStart: (length: number) => [length * 0.16, -8],
      },
      {
        presetId: "backstab" as const,
        expectedStart: (length: number) => [-length * 0.2, -9],
      },
    ];

    for (const { presetId, expectedStart } of cases) {
      const canvas = createCanvasRecorder();
      const car = createCarFixture({}, presetId);

      drawCar(canvas.ctx, car, { showPlayerOutline: false });

      expect(canvas.operations).toContainEqual({
        type: "moveTo",
        args: expectedStart(car.length),
      });
    }
  });

  it("orders axle and tire commands below the deformed car body", () => {
    const canvas = createCanvasRecorder();

    drawCar(canvas.ctx, createCarFixture({ isPlayer: true }));

    const firstFillRect = canvas.operations.findIndex(
      (entry) => entry.type === "fillRect",
    );
    const bodyGradient = canvas.operations.findIndex(
      (entry) => entry.type === "createLinearGradient",
    );
    const axleRects = canvas
      .find("fillRect")
      .filter((entry) => Number(entry.args[2]) === 4);

    expect(firstFillRect).toBeGreaterThanOrEqual(0);
    expect(bodyGradient).toBeGreaterThan(firstFillRect);
    expect(axleRects).toHaveLength(2);
  });

  it("omits HUD and event-feed commands in preview mode", () => {
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

  it("orders running HUD, event-feed, and smoke commands over the arena", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.currentRoundPlan = {
      ...getRoundPlan(state),
      arenaVariant: "junkyard",
    };
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
    const contourStrokes = canvas.find("stroke");
    const spriteCanvases = new Set<unknown>(
      canvas.surfaces.map((surface) => surface.ctx.canvas),
    );
    const smokeIndex = canvas.operations.findIndex(
      (entry) =>
        entry.type === "drawImage" && spriteCanvases.has(entry.args[0]),
    );
    expect(contourStrokes.length).toBeGreaterThan(0);
    expect(smokeIndex).toBeGreaterThan(0);
  });

  it("emits polygon paths for deformed bodies and persistent fragments", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.carFragments.push({
      id: 1,
      sourceCarId: state.playerId,
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 5,
      mass: 20,
      rotation: 0.2,
      spin: 0,
      color: "#446688",
      edgeColor: "#111111",
      points: [
        { x: -4, y: -3 },
        { x: 5, y: -2 },
        { x: 1, y: 4 },
      ],
    });

    renderGame(canvas.ctx, state);

    const fragmentPath = canvas
      .paths("fill")
      .find(
        (path) =>
          path.operations.filter((operation) => operation.type === "lineTo")
            .length === 2,
      );
    expect(fragmentPath).toBeInstanceOf(RecordedPath2D);
  });

  it("draws transient debris, dust, and non-flaming smoke", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.debrisParticles.push({
      id: 1,
      x: 240,
      y: 260,
      vx: 0,
      vy: 0,
      age: 0.2,
      ttl: 1,
      size: 6,
      rotation: 0.4,
      spin: 0,
      tone: 0.7,
    });
    state.dustPuffs.push({
      id: 2,
      x: 300,
      y: 320,
      vx: 0,
      vy: 0,
      age: 0.3,
      ttl: 1,
      size: 10,
      alpha: 0.6,
      tone: 0.8,
    });
    state.smokePuffs.push({
      id: 3,
      sourceCarId: state.playerId,
      x: 340,
      y: 360,
      vx: 0,
      vy: 0,
      age: 0.1,
      ttl: 1,
      size: 8,
      density: 0.4,
      flame: 0,
    });

    renderGame(canvas.ctx, state);

    expect(canvas.count("createRadialGradient")).toBe(0);
    expect(
      canvas.surfaces.reduce(
        (total, surface) =>
          total + surface.count("createRadialGradient"),
        0,
      ),
    ).toBeGreaterThan(0);
    expect(canvas.count("drawImage")).toBeGreaterThan(0);
    expect(canvas.count("fillRect")).toBeGreaterThan(0);
    expect(canvas.count("arc")).toBeGreaterThan(0);
  });

  it("reuses smoke sprites and immutable fragment paths", () => {
    const smokeCanvas = createCanvasRecorder();
    const puffs = [
      {
        id: 1,
        sourceCarId: 1,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        age: 0.25,
        ttl: 1,
        size: 10,
        density: 0.5,
        flame: 0.75,
      },
      {
        id: 2,
        sourceCarId: 1,
        x: 130,
        y: 100,
        vx: 0,
        vy: 0,
        age: 0.25,
        ttl: 1,
        size: 12,
        density: 0.5,
        flame: 0.75,
      },
    ];

    drawSmokePuffs(smokeCanvas.ctx, puffs);
    const surfaceCount = smokeCanvas.surfaces.length;
    const spriteGradientCount = smokeCanvas.surfaces.reduce(
      (total, surface) =>
        total + surface.count("createRadialGradient"),
      0,
    );
    expect(smokeCanvas.count("createRadialGradient")).toBe(0);
    expect(surfaceCount).toBe(2);
    expect(
      smokeCanvas.surfaces.map((surface) => [
        surface.ctx.canvas.width,
        surface.ctx.canvas.height,
      ]),
    ).toEqual([
      [96, 96],
      [96, 96],
    ]);
    expect(smokeCanvas.surfaces[0].gradients[0].stops).toEqual([
      { offset: 0, color: "rgba(94, 92, 88, 0.8)" },
      { offset: 0.55, color: "rgba(57, 54, 51, 1)" },
      { offset: 1, color: "rgba(16, 14, 13, 0.82)" },
    ]);
    expect(smokeCanvas.count("drawImage")).toBe(4);
    expect(smokeCanvas.find("drawImage")[0].args.slice(1)).toEqual([
      86,
      86,
      28,
      28,
    ]);
    const smokeAlphas = smokeCanvas
      .find("set:globalAlpha")
      .slice(0, 2)
      .map((operation) => Number(operation.args[0]));
    expect(smokeAlphas[0]).toBeCloseTo(0.2475);
    expect(smokeAlphas[1]).toBeCloseTo(0.5625);

    drawSmokePuffs(smokeCanvas.ctx, puffs);

    expect(smokeCanvas.surfaces).toHaveLength(surfaceCount);
    expect(
      smokeCanvas.surfaces.reduce(
        (total, surface) =>
          total + surface.count("createRadialGradient"),
        0,
      ),
    ).toBe(spriteGradientCount);
    expect(smokeCanvas.count("drawImage")).toBe(8);

    const fragmentCanvas = createCanvasRecorder();
    const fragment = {
      id: 1,
      sourceCarId: 1,
      x: 10,
      y: 20,
      vx: 0,
      vy: 0,
      radius: 5,
      mass: 30,
      rotation: 0.2,
      spin: 0,
      color: "#446688",
      edgeColor: "#111111",
      points: [
        { x: -4, y: -3 },
        { x: 5, y: -2 },
        { x: 1, y: 4 },
      ],
    };
    drawCarFragments(fragmentCanvas.ctx, [fragment]);
    drawCarFragments(fragmentCanvas.ctx, [fragment]);
    const fragmentFillPaths = fragmentCanvas.paths("fill");
    expect(fragmentFillPaths).toHaveLength(2);
    expect(fragmentFillPaths[1]).toBe(fragmentFillPaths[0]);
  });

  it("bounds the flame sprite cache with least-recently-used eviction", () => {
    const canvas = createCanvasRecorder();
    const puffs = Array.from({ length: 129 }, (_, index) => {
      const flameIndex = 1 + Math.floor(index / 32);
      const lifeIndex = 1 + (index % 32);
      return {
        id: index + 1,
        sourceCarId: 1,
        x: 100 + index,
        y: 100,
        vx: 0,
        vy: 0,
        age: 1 - lifeIndex / 32,
        ttl: 1,
        size: 10,
        density: 0.5,
        flame: flameIndex / 32,
      };
    });

    drawSmokePuffs(canvas.ctx, puffs);
    expect(canvas.surfaces).toHaveLength(130);

    drawSmokePuffs(canvas.ctx, [puffs[0]]);
    expect(canvas.surfaces).toHaveLength(131);
  });

  it("keeps the maximum-density warm render structurally bounded and pure", () => {
    const canvas = createCanvasRecorder();
    const state = createSaturatedRenderState();
    const stateBefore = JSON.stringify(state);

    renderGame(canvas.ctx, state);
    const surfaceCount = canvas.surfaces.length;
    const spriteGradientCount = canvas.surfaces.reduce(
      (total, surface) =>
        total + surface.count("createRadialGradient"),
      0,
    );
    const bodyPathCountAfterFirstRender = new Set(
      canvas
        .paths()
        .filter(
          (path) =>
            path.operations.filter(
              (operation) => operation.type === "lineTo",
            ).length ===
            state.cars[0].frame.vertices.length - 1,
        ),
    ).size;

    renderGame(canvas.ctx, state);

    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(state.cars).toHaveLength(8);
    expect(state.cars.every((car) => car.frame.scars.length === 42)).toBe(
      true,
    );
    expect(state.smokePuffs).toHaveLength(180);
    expect(state.dustPuffs).toHaveLength(180);
    expect(state.debrisParticles).toHaveLength(220);
    expect(state.carFragments).toHaveLength(220);
    expect(canvas.count("createRadialGradient")).toBe(0);
    expect(canvas.count("clip")).toBeLessThanOrEqual(
      state.cars.length * 4 * 2,
    );
    expect(bodyPathCountAfterFirstRender).toBe(state.cars.length);
    expect(
      new Set(
        canvas
          .paths()
          .filter(
            (path) =>
              path.operations.filter(
                (operation) => operation.type === "lineTo",
              ).length ===
              state.cars[0].frame.vertices.length - 1,
          ),
      ).size,
    ).toBe(state.cars.length * 2);
    expect(canvas.surfaces).toHaveLength(surfaceCount);
    expect(
      canvas.surfaces.reduce(
        (total, surface) =>
          total + surface.count("createRadialGradient"),
        0,
      ),
    ).toBe(spriteGradientCount);
  });

  it("emits intro overlay commands with the countdown and title", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.mode = "intro";
    state.session.countdown = 2.4;
    const plan = getRoundPlan(state);

    renderGame(canvas.ctx, state);

    const textCalls = canvas
      .find("fillText")
      .map((entry) => String(entry.args[0]));
    expect(textCalls).toContain(plan.title);
    expect(textCalls).toContain("3");
  });

  it("emits a non-running overlay outside intro", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.mode = "round_results";

    renderGame(canvas.ctx, state);

    expect(
      canvas.operations
        .filter((entry) => !entry.type.startsWith("set:"))
        .slice(-3)
        .map((entry) => entry.type),
    ).toEqual(["save", "fillRect", "restore"]);
  });

  it("emits gradient and rounded-rectangle commands for mud zones", () => {
    const canvas = createCanvasRecorder();
    const state = createRunningState();
    state.currentRoundPlan = {
      ...getRoundPlan(state),
      arenaVariant: "mud_pit",
    };
    state.arena.mudZones = [
      { id: 1, x: 100, y: 100, width: 200, height: 100, grip: 0.6 },
    ];

    renderGame(canvas.ctx, state);

    expect(canvas.count("createLinearGradient")).toBeGreaterThan(1);
    expect(canvas.count("roundRect")).toBeGreaterThan(1);
  });
});
