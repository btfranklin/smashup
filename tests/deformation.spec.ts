import { describe, expect, it } from "vitest";

import { applyImpactDamage } from "../src/game/damage";
import { applyFrameImpact, summarizeFrameDamage } from "../src/game/deformation";
import { createCarFixture } from "./helpers/fixtures";

const MIRRORED_VERTEX_IDS = [
  ["front-tip-left", "front-tip-right"],
  ["front-left-corner", "front-right-corner"],
  ["left-front-fender", "right-front-fender"],
  ["left-door-front", "right-door-front"],
  ["left-door-rear", "right-door-rear"],
  ["rear-left-corner", "rear-right-corner"],
  ["rear-tip-left", "rear-tip-right"],
] as const;

function vertex(car: ReturnType<typeof createCarFixture>, id: string) {
  const found = car.frame.vertices.find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(`Missing frame vertex ${id}`);
  }
  return found;
}

describe("car frame deformation", () => {
  function expectFrameWithinOriginalHull(car: ReturnType<typeof createCarFixture>) {
    for (const point of car.frame.vertices) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(Math.abs(point.baseX) + 0.001);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(Math.abs(point.baseY) + 0.001);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(car.length * 0.5 + 0.001);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(car.width * 0.5 + 0.001);
    }
  }

  function expectFrameToKeepCarLikeProportions(
    car: ReturnType<typeof createCarFixture>,
  ) {
    for (const point of car.frame.vertices) {
      expect(Math.abs(point.x)).toBeGreaterThanOrEqual(
        Math.abs(point.baseX) * 0.57,
      );
      expect(Math.abs(point.y)).toBeGreaterThanOrEqual(
        Math.abs(point.baseY) * 0.57,
      );
    }

    for (const [firstId, secondId] of MIRRORED_VERTEX_IDS) {
      const first = vertex(car, firstId);
      const second = vertex(car, secondId);
      expect(Math.abs(Math.abs(first.x) - Math.abs(second.x))).toBeLessThanOrEqual(
        car.length * 0.141,
      );
      expect(Math.abs(Math.abs(first.y) - Math.abs(second.y))).toBeLessThanOrEqual(
        car.width * 0.141,
      );
    }

    const frontProfile = [
      vertex(car, "front-tip-left").x,
      vertex(car, "front-left-corner").x,
      vertex(car, "front-right-corner").x,
      vertex(car, "front-tip-right").x,
    ];
    const rearProfile = [
      vertex(car, "rear-left-corner").x,
      vertex(car, "rear-tip-left").x,
      vertex(car, "rear-tip-right").x,
      vertex(car, "rear-right-corner").x,
    ].map(Math.abs);
    expect(Math.max(...frontProfile) - Math.min(...frontProfile)).toBeLessThanOrEqual(
      car.length * 0.071,
    );
    expect(Math.max(...rearProfile) - Math.min(...rearProfile)).toBeLessThanOrEqual(
      car.length * 0.071,
    );
    expect(vertex(car, "front-tip-left").x).toBeGreaterThanOrEqual(
      vertex(car, "front-left-corner").x,
    );
    expect(vertex(car, "front-tip-right").x).toBeGreaterThanOrEqual(
      vertex(car, "front-right-corner").x,
    );
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
    expectFrameToKeepCarLikeProportions(direct);
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
    expectFrameToKeepCarLikeProportions(car);
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
    expect(rightTip.x).toBeGreaterThanOrEqual(rightTip.baseX * 0.58);
    expect(Math.abs(leftTip.x - rightTip.x)).toBeLessThanOrEqual(
      car.length * 0.141,
    );
    expectFrameToKeepCarLikeProportions(car);
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
});
