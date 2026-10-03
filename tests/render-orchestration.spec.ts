import { describe, expect, it } from "vitest";

import { CAR_PRESET_IDS } from "../src/game/contentIds";
import { applyFrameImpact } from "../src/game/deformation";
import {
  drawCars,
  getCameraOffset,
  getPhaseColor,
  renderGame,
} from "../src/game/render";
import { createCarPreviewState } from "../src/game/session";
import { createCanvasRecorder } from "./helpers/canvas-recorder";
import {
  createCarFixture,
  createRunningState,
} from "./helpers/fixtures";

function getRoundPlan(state: ReturnType<typeof createRunningState>) {
  const plan = state.currentRoundPlan;
  if (!plan) {
    throw new Error("Running render fixture is missing its round plan.");
  }
  return plan;
}

describe("render facade, cars, and overlays", () => {
  it("derives phase colors and camera offsets", () => {
    expect(getPhaseColor("healthy", "#123")).toBe("#123");
    expect(getPhaseColor("wounded", "#123")).toBe("#e0c15b");
    expect(getPhaseColor("failing", "#123")).toBe("#ec8c41");
    expect(getPhaseColor("critical", "#123")).toBe("#e24a33");

    expect(
      getCameraOffset({
        roundTick: 10,
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
      drawCars(canvas.ctx, [createCarFixture({ isPlayer: true })]),
    ).not.toThrow();
    expect(() =>
      drawCars(canvas.ctx, [createCarFixture({ disabled: true })], {
        showPlayerOutline: false,
      }),
    ).not.toThrow();
  });

  it("reuses one body path per car and skips disabled body gradients", () => {
    const activeCanvas = createCanvasRecorder();
    const activeCar = createCarFixture({ isPlayer: true });

    drawCars(activeCanvas.ctx, [activeCar]);

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
    drawCars(
      disabledCanvas.ctx,
      [createCarFixture({ disabled: true, isPlayer: false })],
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

    drawCars(canvas.ctx, [car], { showPlayerOutline: false });

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

      drawCars(canvas.ctx, [car], { showPlayerOutline: false });

      expect(canvas.operations).toContainEqual({
        type: "moveTo",
        args: expectedStart(car.length),
      });
    }
  });

  it("draws every axle and tire before any car body", () => {
    const canvas = createCanvasRecorder();
    const cars = [
      createCarFixture({ id: 201, isPlayer: true }),
      createCarFixture({ id: 202, disabled: true }),
    ];

    drawCars(canvas.ctx, cars);

    const lastWheelOrAxle = canvas.operations.findLastIndex(
      (operation) => operation.type === "fillRect",
    );
    const firstBodyFill = canvas.operations.findIndex(
      (operation) => operation.type === "fill",
    );
    const axleRects = canvas
      .find("fillRect")
      .filter((entry) => Number(entry.args[2]) === 4);

    expect(lastWheelOrAxle).toBeGreaterThanOrEqual(0);
    expect(firstBodyFill).toBeGreaterThan(lastWheelOrAxle);
    expect(axleRects).toHaveLength(cars.length * 2);
  });

  it.each(CAR_PRESET_IDS)(
    "keeps the %s chassis and end panels inside the damaged shell",
    (presetId) => {
      const car = createCarFixture({ disabled: true }, presetId);
      for (let hit = 0; hit < 40; hit += 1) {
        const side = ((hit % 5) - 2) * car.width * 0.22;
        const end = ((hit % 7) - 3) * car.length * 0.12;
        applyFrameImpact(
          car, { x: car.length * 0.5, y: side }, 1, "front", { x: -1, y: 0 },
        );
        applyFrameImpact(
          car, { x: -car.length * 0.5, y: -side }, 1, "rear", { x: 1, y: 0 },
        );
        applyFrameImpact(
          car, { x: end, y: -car.width * 0.5 }, 1, "left", { x: 0, y: 1 },
        );
        applyFrameImpact(
          car, { x: -end, y: car.width * 0.5 }, 1, "right", { x: 0, y: -1 },
        );
      }
      const canvas = createCanvasRecorder();
      drawCars(canvas.ctx, [car], { showPlayerOutline: false });
      const panels = canvas.paths("fill").filter((path) =>
        path.operations.filter((operation) => operation.type === "lineTo").length
          !== car.frame.vertices.length - 1,
      );
      expect(panels.length).toBeGreaterThanOrEqual(4);
      for (const panel of panels) {
        for (const operation of panel.operations) {
          if (operation.type !== "moveTo" && operation.type !== "lineTo") {
            continue;
          }
          const [x, y] = operation.args as number[];
          let inside = false;
          for (let index = 0; index < car.frame.vertices.length; index += 1) {
            const start = car.frame.vertices[index];
            const end = car.frame.vertices[(index + 1) % car.frame.vertices.length];
            if (
              (start.y > y) !== (end.y > y) &&
              x < ((end.x - start.x) * (y - start.y)) / (end.y - start.y) + start.x
            ) {
              inside = !inside;
            }
          }
          expect(inside, `Panel point ${x}, ${y} must stay inside the body`).toBe(true);
        }
      }
    },
  );

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

  it("fails clearly when preview state has no player car", () => {
    const canvas = createCanvasRecorder();
    const state = createCarPreviewState("bulldozer", "critical");
    state.cars = [];

    expect(() => renderGame(canvas.ctx, state)).toThrow(
      'Mode "car_preview" requires a player car.',
    );
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
