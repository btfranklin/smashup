import { clamp01, pseudoRandom } from "./math";
import { getCarPolygonContact } from "./physics";
import { getCarById } from "./selectors";
import type { Car, CarFragment, CollisionEvent, GameState, Vec2 } from "./types";

const FRAGMENT_COLLISION_THRESHOLD = 0.68;
const FRAGMENT_DAMAGE_THRESHOLD = 0.18;
const FRAGMENT_DEFORMATION_THRESHOLD = 0.055;
const MAX_FRAGMENTS = 220;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return { r: 120, g: 112, b: 100 };
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mixColor(color: string, target: string, amount: number): string {
  const from = hexToRgb(color);
  const to = hexToRgb(target);
  const r = Math.round(from.r + (to.r - from.r) * amount);
  const g = Math.round(from.g + (to.g - from.g) * amount);
  const b = Math.round(from.b + (to.b - from.b) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function fragmentPalette(car: Car, seed: number): { color: string; edgeColor: string } {
  const roll = pseudoRandom(seed);
  if (roll > 0.86) {
    return { color: "#857d72", edgeColor: "#37312d" };
  }
  if (roll > 0.76) {
    return { color: "#2f2925", edgeColor: "#161311" };
  }
  const base = roll > 0.42 ? car.accent : car.color;
  return {
    color: mixColor(base, "#6b6259", pseudoRandom(seed + 1) * 0.35),
    edgeColor: mixColor(base, "#161311", 0.62),
  };
}

function cross(origin: Vec2, first: Vec2, second: Vec2): number {
  return (
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x)
  );
}

function createFragmentPoints(radius: number, seed: number): Vec2[] {
  const count = 3 + Math.floor(pseudoRandom(seed) * 3);
  const points = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + pseudoRandom(seed + index + 1) * 0.52;
    const distance = radius * (0.46 + pseudoRandom(seed + index + 7) * 0.62);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
  const sorted = [...points].sort(
    (first, second) => first.x - second.x || first.y - second.y,
  );
  const lower: Vec2[] = [];
  const upper: Vec2[] = [];

  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function spawnFragmentsForCar(
  state: GameState,
  collision: CollisionEvent,
  car: Car | undefined,
  point: Vec2,
  away: Vec2,
  damageTaken: number,
  deformation: number,
  seedBase: number,
): void {
  if (!car || collision.damageSeverity < FRAGMENT_COLLISION_THRESHOLD) {
    return;
  }
  if (
    damageTaken < FRAGMENT_DAMAGE_THRESHOLD ||
    deformation < FRAGMENT_DEFORMATION_THRESHOLD
  ) {
    return;
  }

  const tangent = { x: -away.y, y: away.x };
  const materialLoss = clamp01(damageTaken * 0.55 + deformation * 1.15);
  const count = Math.round(
    1 + materialLoss * 1.7 + Math.max(0, damageTaken - 0.82) * 1.2,
  );
  for (let index = 0; index < count; index += 1) {
    const seed = seedBase + index * 17;
    const radius = 2.6 + pseudoRandom(seed + 1) * (3.6 + materialLoss * 3.2);
    const scatter = (pseudoRandom(seed + 2) - 0.5) * 2;
    const blast = 58 + materialLoss * 210 + damageTaken * 80;
    const palette = fragmentPalette(car, seed + 3);
    state.carFragments.push({
      id: state.nextCarFragmentId++,
      sourceCarId: car.id,
      x: point.x + away.x * 4 + tangent.x * scatter * 4,
      y: point.y + away.y * 4 + tangent.y * scatter * 4,
      vx:
        car.vx * 0.28 +
        away.x * (40 + pseudoRandom(seed + 4) * blast) +
        tangent.x * scatter * 60,
      vy:
        car.vy * 0.28 +
        away.y * (40 + pseudoRandom(seed + 5) * blast) +
        tangent.y * scatter * 60,
      radius,
      mass: 18 + radius * 4,
      rotation: pseudoRandom(seed + 6) * Math.PI * 2,
      spin: (pseudoRandom(seed + 7) - 0.5) * (7 + materialLoss * 10),
      color: palette.color,
      edgeColor: palette.edgeColor,
      points: createFragmentPoints(radius, seed + 8),
    });
  }
}

export function spawnCarFragments(state: GameState): void {
  for (const collision of state.recentCollisions) {
    if (collision.damageSeverity < FRAGMENT_COLLISION_THRESHOLD) {
      continue;
    }
    const seed =
      state.roundTick * 131 +
      collision.aId * 23 +
      collision.bId * 37 +
      collision.point.x * 0.13 +
      collision.point.y * 0.17;
    spawnFragmentsForCar(
      state,
      collision,
      getCarById(state, collision.aId),
      collision.pointA,
      { x: -collision.normal.x, y: -collision.normal.y },
      collision.damageTakenA,
      collision.deformationA,
      seed,
    );
    spawnFragmentsForCar(
      state,
      collision,
      getCarById(state, collision.bId),
      collision.pointB,
      collision.normal,
      collision.damageTakenB,
      collision.deformationB,
      seed + 900,
    );
  }
  state.carFragments = state.carFragments.slice(-MAX_FRAGMENTS);
}

function constrainFragment(fragment: CarFragment, arena: GameState["arena"]): void {
  const minX = arena.wallPadding + fragment.radius;
  const maxX = arena.width - arena.wallPadding - fragment.radius;
  const minY = arena.wallPadding + fragment.radius;
  const maxY = arena.height - arena.wallPadding - fragment.radius;
  if (fragment.x < minX) {
    fragment.x = minX;
    fragment.vx = Math.abs(fragment.vx) * 0.48;
  } else if (fragment.x > maxX) {
    fragment.x = maxX;
    fragment.vx = -Math.abs(fragment.vx) * 0.48;
  }
  if (fragment.y < minY) {
    fragment.y = minY;
    fragment.vy = Math.abs(fragment.vy) * 0.48;
  } else if (fragment.y > maxY) {
    fragment.y = maxY;
    fragment.vy = -Math.abs(fragment.vy) * 0.48;
  }
}

export function updateCarFragments(state: GameState, dt: number): void {
  for (const fragment of state.carFragments) {
    fragment.x += fragment.vx * dt;
    fragment.y += fragment.vy * dt;
    fragment.vx *= Math.pow(0.94, dt * 60);
    fragment.vy *= Math.pow(0.94, dt * 60);
    fragment.rotation += fragment.spin * dt;
    fragment.spin *= Math.pow(0.91, dt * 60);
    constrainFragment(fragment, state.arena);
  }
}

export function pushCarFragments(state: GameState): void {
  for (const fragment of state.carFragments) {
    const cosine = Math.cos(fragment.rotation);
    const sine = Math.sin(fragment.rotation);
    const fragmentHull = fragment.points.map((point) => ({
      x: fragment.x + point.x * cosine - point.y * sine,
      y: fragment.y + point.x * sine + point.y * cosine,
    }));
    for (const car of state.cars) {
      const contact = getCarPolygonContact(car, fragmentHull);
      if (!contact) {
        continue;
      }

      const normal = contact.axis;
      fragment.x += normal.x * contact.amount;
      fragment.y += normal.y * contact.amount;
      translateFragmentHull(
        fragmentHull,
        normal.x * contact.amount,
        normal.y * contact.amount,
      );
      const relativeSpeed =
        (car.vx - fragment.vx) * normal.x + (car.vy - fragment.vy) * normal.y;
      if (relativeSpeed > 0) {
        fragment.vx += normal.x * relativeSpeed * 0.82;
        fragment.vy += normal.y * relativeSpeed * 0.82;
        fragment.spin += relativeSpeed * 0.035;
      }
      const previousX = fragment.x;
      const previousY = fragment.y;
      constrainFragment(fragment, state.arena);
      translateFragmentHull(
        fragmentHull, fragment.x - previousX, fragment.y - previousY,
      );
    }
  }
}

function translateFragmentHull(hull: Vec2[], x: number, y: number): void {
  for (const point of hull) {
    point.x += x;
    point.y += y;
  }
}

export function getRecentFragmentSummary(state: GameState): Array<{
  sourceCarId: number;
  x: number;
  y: number;
  radius: number;
}> {
  return state.carFragments.slice(-6).map((fragment) => ({
    sourceCarId: fragment.sourceCarId,
    x: Number(fragment.x.toFixed(1)),
    y: Number(fragment.y.toFixed(1)),
    radius: Number(fragment.radius.toFixed(1)),
  }));
}
