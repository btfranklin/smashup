import { describe, expect, it } from "vitest";

import { applyImpactDamage } from "../src/game/damage";
import { applyFrameImpact, summarizeFrameDamage } from "../src/game/deformation";
import { createCarFixture } from "./helpers/fixtures";

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

  it("keeps repeated extreme impacts inside the original car hull", () => {
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
      { x: 1, y: 0 },
    );

    expect(deformation).toBeGreaterThan(0);
    expect(car.systems).toEqual(beforeSystems);
    expect(car.body).toEqual(beforeBody);
  });
});
