import { describe, expect, it } from "vitest";

import { CAR_PRESET_IDS } from "../src/game/contentIds";
import { captureCarCondition, cloneCondition } from "../src/game/conditions";
import { applyImpactDamage } from "../src/game/damage";
import {
  applyFrameImpact,
  repairCarFrame,
  summarizeFrameDamage,
} from "../src/game/deformation";
import type { Vec2 } from "../src/game/types";
import { createCarFixture } from "./helpers/fixtures";

function vertex(car: ReturnType<typeof createCarFixture>, id: string) {
  const found = car.frame.vertices.find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(`Missing frame vertex ${id}`);
  }
  return found;
}

function isInsideShell(car: ReturnType<typeof createCarFixture>, point: Vec2) {
  let inside = false;
  const vertices = car.frame.vertices;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (
      (start.y > point.y) !== (end.y > point.y) &&
      point.x <
        ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

describe("car frame deformation", () => {
  function expectFrameWithinOriginalHull(car: ReturnType<typeof createCarFixture>) {
    for (const point of car.frame.vertices) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(car.length * 0.5 + 0.001);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(car.width * 0.5 + 0.001);
    }
  }

  function expectSupportedBody(
    car: ReturnType<typeof createCarFixture>,
  ) {
    const xs = car.frame.vertices.map((point) => point.x);
    const ys = car.frame.vertices.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(
      car.length * 0.78,
    );
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(
      car.width * 0.85,
    );
    for (const side of ["left", "right"]) {
      const front = vertex(car, `${side}-front-fender`);
      const rear = vertex(car, `${side}-door-rear`);
      expect(front.x - rear.x).toBeGreaterThanOrEqual(car.length * 0.46);
      expect(Math.abs(front.y)).toBeGreaterThanOrEqual(car.width * 0.42);
      expect(Math.abs(rear.y)).toBeGreaterThanOrEqual(car.width * 0.42);
    }
  }

  it("crumples front, rear, left, and right frame vertices inward from local impacts", () => {
    const front = createCarFixture();
    const frontBefore = vertex(front, "front-tip-left").x;
    const rearBefore = vertex(front, "rear-tip-left").x;
    applyImpactDamage(
      front,
      { x: front.x + front.length * 0.5, y: front.y - front.width * 0.12 },
      0.9,
      { x: -1, y: 0 },
    );
    expect(vertex(front, "front-tip-left").x).toBeLessThan(frontBefore);
    expect(vertex(front, "rear-tip-left").x).toBeCloseTo(rearBefore, 1);

    const rear = createCarFixture();
    const rearBeforeX = vertex(rear, "rear-tip-right").x;
    applyImpactDamage(
      rear,
      { x: rear.x - rear.length * 0.5, y: rear.y },
      0.8,
      { x: 1, y: 0 },
    );
    expect(vertex(rear, "rear-tip-right").x).toBeGreaterThan(rearBeforeX);

    const left = createCarFixture();
    const leftBeforeY = vertex(left, "left-front-fender").y;
    applyImpactDamage(
      left,
      { x: left.x, y: left.y - left.width * 0.5 },
      0.8,
      { x: 0, y: 1 },
    );
    expect(vertex(left, "left-front-fender").y).toBeGreaterThan(leftBeforeY);

    const right = createCarFixture();
    const rightBeforeY = vertex(right, "right-front-fender").y;
    applyImpactDamage(
      right,
      { x: right.x, y: right.y + right.width * 0.5 },
      0.8,
      { x: 0, y: -1 },
    );
    expect(vertex(right, "right-front-fender").y).toBeLessThan(rightBeforeY);
  });

  it.each([
    { zone: "front", x: 0.5, y: 0, inwardX: -1, inwardY: 0 },
    { zone: "rear", x: -0.5, y: 0, inwardX: 1, inwardY: 0 },
    { zone: "left", x: 0, y: -0.5, inwardX: 0, inwardY: 1 },
    { zone: "right", x: 0, y: 0.5, inwardX: 0, inwardY: -1 },
  ])("crushes the $zone more from a direct impact than a glancing impact", ({
    x, y, inwardX, inwardY,
  }) => {
    const direct = createCarFixture();
    const glancing = createCarFixture();
    const point = {
      x: direct.x + direct.length * x,
      y: direct.y + direct.width * y,
    };
    const directDeformation = applyImpactDamage(direct, point, 0.55, {
      x: inwardX,
      y: inwardY,
    });
    const glancingDeformation = applyImpactDamage(glancing, point, 0.55, {
      x: inwardX * 0.5 - inwardY * Math.sqrt(0.75),
      y: inwardY * 0.5 + inwardX * Math.sqrt(0.75),
    });

    expect(directDeformation).toBeGreaterThan(glancingDeformation);
    expectFrameWithinOriginalHull(direct);
    expectSupportedBody(direct);
  });

  it("accumulates repeated deformation and summarizes compact frame damage", () => {
    const car = createCarFixture();
    const before = vertex(car, "front-tip-right").x;

    applyImpactDamage(
      car,
      { x: car.x + car.length * 0.5, y: car.y + car.width * 0.14 },
      0.55,
      { x: -1, y: 0 },
    );
    const first = vertex(car, "front-tip-right").x;
    applyImpactDamage(
      car,
      { x: car.x + car.length * 0.5, y: car.y + car.width * 0.14 },
      0.55,
      { x: -1, y: 0 },
    );

    expect(first).toBeLessThan(before);
    expect(vertex(car, "front-tip-right").x).toBeLessThan(first);
    expect(summarizeFrameDamage(car.frame).front).toBeGreaterThan(0);
    expect(car.frame.scars.length).toBeGreaterThan(1);
    expectFrameWithinOriginalHull(car);
  });

  it("keeps repeated extreme impacts inside a recognizable car-shaped envelope", () => {
    const car = createCarFixture();

    for (let index = 0; index < 16; index += 1) {
      applyImpactDamage(
        car,
        {
          x: car.x + car.length * 0.5,
          y: car.y + (index % 2 === 0 ? car.width * 0.45 : -car.width * 0.45),
        },
        1,
        { x: -1, y: index % 2 === 0 ? -0.8 : 0.8 },
      );
      applyImpactDamage(
        car,
        {
          x: car.x + (index % 2 === 0 ? car.length * 0.42 : -car.length * 0.42),
          y: car.y - car.width * 0.5,
        },
        0.95,
        { x: index % 2 === 0 ? -0.5 : 0.5, y: 1 },
      );
    }

    expectFrameWithinOriginalHull(car);
    expectSupportedBody(car);
  });

  it("caps a localized crumple before one body rail collapses into a point", () => {
    const car = createCarFixture();
    const impactPoint = {
      x: car.length * 0.5,
      y: car.width * 0.42,
    };

    for (let index = 0; index < 24; index += 1) {
      applyFrameImpact(car, impactPoint, 1, "front", { x: -1, y: 0 });
    }

    const leftTip = vertex(car, "front-tip-left");
    const rightTip = vertex(car, "front-tip-right");
    expect(rightTip.x).toBeLessThan(rightTip.baseX);
    expect(rightTip.x).toBeGreaterThanOrEqual(car.length * 0.39);
    expect(leftTip.x).toBe(leftTip.baseX);
    expect(vertex(car, "rear-tip-right").x).toBe(
      vertex(car, "rear-tip-right").baseX,
    );
    expectSupportedBody(car);
  });

  it("can visually deform disabled cars without applying more gameplay damage", () => {
    const car = createCarFixture({
      disabled: true,
      systems: {
        engine: 0.2,
        radiator: 0.2,
        transmission: 0.2,
        steering: 0.2,
        overheat: 0,
      },
      body: { front: 0.3, rear: 0.1, left: 0.1, right: 0.1 },
    });
    const beforeSystems = { ...car.systems };
    const beforeBody = { ...car.body };
    const deformation = applyFrameImpact(
      car,
      { x: car.length * 0.5, y: 0 },
      0.9,
      "front",
      { x: -1, y: 0 },
    );

    expect(deformation).toBeGreaterThan(0);
    expect(car.systems).toEqual(beforeSystems);
    expect(car.body).toEqual(beforeBody);
  });

  it.each(CAR_PRESET_IDS)(
    "keeps the %s wheelbase, body footprint, and visible folds after repeated hits",
    (presetId) => {
      const car = createCarFixture({}, presetId);
      for (let hit = 0; hit < 24; hit += 1) {
        applyFrameImpact(
          car,
          { x: car.length * 0.5, y: 0 },
          1,
          "front",
          { x: -1, y: 0 },
        );
        applyFrameImpact(
          car,
          { x: -car.length * 0.5, y: 0 },
          1,
          "rear",
          { x: 1, y: 0 },
        );
        applyFrameImpact(
          car,
          { x: -car.length * 0.1, y: -car.width * 0.5 },
          1,
          "left",
          { x: 0, y: 1 },
        );
        applyFrameImpact(
          car,
          { x: car.length * 0.1, y: car.width * 0.5 },
          1,
          "right",
          { x: 0, y: -1 },
        );
      }

      expectFrameWithinOriginalHull(car);
      expectSupportedBody(car);
      expect(car.frame.scars).toHaveLength(42);
      for (const scar of car.frame.scars) {
        expect(Number.isFinite(scar.x) && Number.isFinite(scar.y)).toBe(true);
        expect(isInsideShell(car, scar)).toBe(true);
      }
    },
  );

  it.each(["front", "rear", "left", "right"] as const)(
    "keeps %s dents and scars local through service and condition carry-over",
    (zone) => {
      const car = createCarFixture();
      const direction = {
        x: zone === "front" ? -1 : zone === "rear" ? 1 : 0,
        y: zone === "left" ? 1 : zone === "right" ? -1 : 0,
      };
      for (let hit = 0; hit < 100; hit += 1) {
        const offset = ((hit % 9) - 4) * 0.11;
        const point = direction.x
          ? { x: -direction.x * car.length * 0.5, y: offset * car.width }
          : { x: offset * car.length, y: -direction.y * car.width * 0.5 };
        applyFrameImpact(car, point, 0.9, zone, direction);
      }
      const damaged = captureCarCondition(car);
      const carried = cloneCondition(damaged);
      expect(carried.frame).toEqual(car.frame);
      expect(carried.frame).not.toBe(car.frame);

      for (const amount of [0.12, 0.28, 0.6]) {
        const repaired = repairCarFrame(carried.frame, amount)!;
        const serviced = createCarFixture({ frame: repaired });
        expectFrameWithinOriginalHull(serviced);
        expectSupportedBody(serviced);
        for (const scar of repaired.scars) {
          expect(isInsideShell(serviced, scar)).toBe(true);
        }
      }
      expect(carried.frame).toEqual(damaged.frame);
    },
  );
});
