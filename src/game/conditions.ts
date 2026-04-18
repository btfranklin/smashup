import type { Car, CarCondition } from "./types";

export function createFreshCondition(): CarCondition {
  return {
    systems: {
      engine: 1,
      radiator: 1,
      transmission: 1,
      steering: 1,
      overheat: 0,
    },
    body: {
      front: 0,
      rear: 0,
      left: 0,
      right: 0,
    },
    lights: {
      frontLeft: true,
      frontRight: true,
      rearLeft: true,
      rearRight: true,
    },
  };
}

export function cloneCondition(condition: CarCondition): CarCondition {
  return {
    systems: { ...condition.systems },
    body: { ...condition.body },
    lights: { ...condition.lights },
  };
}

export function captureCarCondition(
  car: Pick<Car, "systems" | "body" | "lights">,
): CarCondition {
  return {
    systems: { ...car.systems },
    body: { ...car.body },
    lights: { ...car.lights },
  };
}
