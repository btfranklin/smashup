import { describe, expect, it } from "vitest";

import { renderGame } from "../src/game/render";
import {
  drawCarFragments,
  drawSmokePuffs,
} from "../src/game/render/effects";
import {
  createCanvasRecorder,
  RecordedPath2D,
} from "./helpers/canvas-recorder";
import {
  createRunningState,
  createSaturatedRenderState,
} from "./helpers/fixtures";

describe("render effects and caches", () => {
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
});
