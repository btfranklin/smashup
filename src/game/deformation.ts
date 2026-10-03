import { clamp, clamp01, pseudoRandom } from "./math";
import type {
  BodyState,
  Car,
  CarFrameState,
  CrumpleScar,
  DamageZone,
  FrameVertex,
  Vec2,
} from "./types";

const FRAME_VERTEX_DEFS: Array<{
  id: string;
  x: number;
  y: number;
  stiffness: number;
}> = [
  { id: "front-tip-left", x: 0.5, y: -0.21, stiffness: 0.44 },
  { id: "front-left-corner", x: 0.45, y: -0.45, stiffness: 0.5 },
  { id: "left-front-fender", x: 0.18, y: -0.5, stiffness: 0.88 },
  { id: "left-door-front", x: -0.1, y: -0.49, stiffness: 0.72 },
  { id: "left-door-rear", x: -0.34, y: -0.47, stiffness: 0.86 },
  { id: "rear-left-corner", x: -0.5, y: -0.37, stiffness: 0.56 },
  { id: "rear-tip-left", x: -0.48, y: -0.18, stiffness: 0.5 },
  { id: "rear-tip-right", x: -0.48, y: 0.18, stiffness: 0.5 },
  { id: "rear-right-corner", x: -0.5, y: 0.37, stiffness: 0.56 },
  { id: "right-door-rear", x: -0.34, y: 0.47, stiffness: 0.86 },
  { id: "right-door-front", x: -0.1, y: 0.49, stiffness: 0.72 },
  { id: "right-front-fender", x: 0.18, y: 0.5, stiffness: 0.88 },
  { id: "front-right-corner", x: 0.45, y: 0.45, stiffness: 0.5 },
  { id: "front-tip-right", x: 0.5, y: 0.21, stiffness: 0.44 },
];

function cloneBodyState(body: BodyState): BodyState {
  return {
    front: body.front,
    rear: body.rear,
    left: body.left,
    right: body.right,
  };
}

export function cloneCarFrame(frame: CarFrameState): CarFrameState {
  return {
    vertices: frame.vertices.map((vertex) => ({ ...vertex })),
    scars: frame.scars.map((scar) => ({ ...scar })),
    crush: cloneBodyState(frame.crush),
    nextScarId: frame.nextScarId,
  };
}

export function createFreshFrame(length: number, width: number): CarFrameState {
  return {
    vertices: FRAME_VERTEX_DEFS.map((vertex): FrameVertex => ({
      id: vertex.id,
      baseX: vertex.x * length,
      baseY: vertex.y * width,
      x: vertex.x * length,
      y: vertex.y * width,
      stiffness: vertex.stiffness,
    })),
    scars: [],
    crush: { front: 0, rear: 0, left: 0, right: 0 },
    nextScarId: 1,
  };
}

function constrainFrameVertex(
  vertex: FrameVertex,
  length: number,
  width: number,
): void {
  const endPanel = Math.abs(vertex.baseX) >= length * 0.4;
  const wheelSupported =
    (vertex.baseX > length * 0.1 && vertex.baseX < length * 0.25) ||
    (vertex.baseX < -length * 0.25 && vertex.baseX > -length * 0.38);
  const sidePanel = Math.abs(vertex.baseY) > width * 0.4;
  const longitudinalDent = length * (endPanel ? 0.1 : 0.025);
  const lateralDent = width * (wheelSupported ? 0.04 : sidePanel ? 0.1 : 0.035);

  // The wheel mounts and cabin support the shell. Dents stay local to a panel.
  vertex.x = clamp(
    vertex.x,
    Math.max(-length * 0.5, vertex.baseX - longitudinalDent),
    Math.min(length * 0.5, vertex.baseX + longitudinalDent),
  );
  vertex.y = clamp(
    vertex.y,
    Math.max(-width * 0.5, vertex.baseY - lateralDent),
    Math.min(width * 0.5, vertex.baseY + lateralDent),
  );
}

function constrainFrameShape(
  frame: CarFrameState,
  length: number,
  width: number,
): void {
  for (const vertex of frame.vertices) {
    constrainFrameVertex(vertex, length, width);
  }
}

function keepScarOnShell(frame: CarFrameState, scar: CrumpleScar): void {
  let inside = false;
  let nearestX = scar.x;
  let nearestY = scar.y;
  let nearestDistance = Infinity;
  const vertices = frame.vertices;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (
      (start.y > scar.y) !== (end.y > scar.y) &&
      scar.x <
        ((end.x - start.x) * (scar.y - start.y)) / (end.y - start.y) + start.x
    ) {
      inside = !inside;
    }
    const edgeX = end.x - start.x;
    const edgeY = end.y - start.y;
    const along = clamp(
      ((scar.x - start.x) * edgeX + (scar.y - start.y) * edgeY) /
        (edgeX * edgeX + edgeY * edgeY),
      0,
      1,
    );
    const x = start.x + edgeX * along;
    const y = start.y + edgeY * along;
    const distance = (scar.x - x) ** 2 + (scar.y - y) ** 2;
    if (distance < nearestDistance) {
      nearestX = x;
      nearestY = y;
      nearestDistance = distance;
    }
  }
  if (!inside) {
    const inwardLength = Math.hypot(nearestX, nearestY);
    scar.x = nearestX - (nearestX / inwardLength) * 2;
    scar.y = nearestY - (nearestY / inwardLength) * 2;
  }
}

function zoneAxis(zone: DamageZone): Vec2 {
  switch (zone) {
    case "front":
      return { x: -1, y: 0 };
    case "rear":
      return { x: 1, y: 0 };
    case "left":
      return { x: 0, y: 1 };
    case "right":
      return { x: 0, y: -1 };
  }
}

function zoneCoordinate(zone: DamageZone, vertex: FrameVertex): number {
  switch (zone) {
    case "front":
      return vertex.baseX;
    case "rear":
      return -vertex.baseX;
    case "left":
      return -vertex.baseY;
    case "right":
      return vertex.baseY;
  }
}

function impactCoordinate(zone: DamageZone, point: Vec2): number {
  switch (zone) {
    case "front":
      return point.x;
    case "rear":
      return -point.x;
    case "left":
      return -point.y;
    case "right":
      return point.y;
  }
}

function crossCoordinate(zone: DamageZone, vertex: FrameVertex): number {
  return zone === "front" || zone === "rear" ? vertex.baseY : vertex.baseX;
}

function crossImpactCoordinate(zone: DamageZone, point: Vec2): number {
  return zone === "front" || zone === "rear" ? point.y : point.x;
}

function scarAngle(zone: DamageZone, impactSide: number, seed: number): number {
  const jitter = (pseudoRandom(seed) - 0.5) * 0.45;
  if (zone === "front" || zone === "rear") {
    return Math.PI * 0.5 + (impactSide >= 0 ? 0.25 : -0.25) + jitter;
  }
  return (impactSide >= 0 ? -0.25 : 0.25) + jitter;
}

function addCrumpleScars(
  frame: CarFrameState,
  zone: DamageZone,
  point: Vec2,
  severity: number,
  impactSide: number,
): void {
  const count = Math.max(1, Math.round(1 + severity * 4));
  for (let index = 0; index < count; index += 1) {
    const seed = frame.nextScarId * 19 + index * 7 + severity * 31;
    const scar: CrumpleScar = {
      id: frame.nextScarId++,
      x:
        point.x +
        (pseudoRandom(seed + 1) - 0.5) *
          (zone === "front" || zone === "rear" ? 18 : 30),
      y:
        point.y +
        (pseudoRandom(seed + 2) - 0.5) *
          (zone === "front" || zone === "rear" ? 30 : 18),
      angle: scarAngle(zone, impactSide, seed + 3),
      length: 8 + severity * 28 + pseudoRandom(seed + 4) * 10,
      depth: clamp01(severity * (0.55 + pseudoRandom(seed + 5) * 0.45)),
      width: 1.4 + severity * 2.8 + pseudoRandom(seed + 6) * 1.4,
    };
    keepScarOnShell(frame, scar);
    frame.scars.push(scar);
  }
  frame.scars = frame.scars.slice(-42);
}

export function applyFrameImpact(
  car: Car,
  localPoint: Vec2,
  severity: number,
  zone: DamageZone,
  localDirection: Vec2,
): number {
  const frame = car.frame;
  const scaled = clamp01(severity);
  if (scaled <= 0) {
    return 0;
  }

  const zoneInward = zoneAxis(zone);
  const directness = clamp01(
    Math.max(0.28, localDirection.x * zoneInward.x + localDirection.y * zoneInward.y),
  );
  const impactDepth = impactCoordinate(zone, localPoint);
  const cross = crossImpactCoordinate(zone, localPoint);
  const zoneSpan = zone === "front" || zone === "rear" ? car.length : car.width;
  const crossSpan = zone === "front" || zone === "rear" ? car.width : car.length;
  const band = zoneSpan * (0.2 + scaled * 0.12);
  const crossBand = crossSpan * (0.36 + scaled * 0.22);
  const baseCrush = (1.2 + scaled * 9.5) * directness;
  let deformation = 0;

  for (const vertex of frame.vertices) {
    const zoneDistance = Math.max(0, impactDepth - zoneCoordinate(zone, vertex));
    const zoneWeight = clamp01(1 - zoneDistance / band);
    const crossDistance = Math.abs(crossCoordinate(zone, vertex) - cross);
    const crossWeight = clamp01(1 - crossDistance / crossBand);
    const weight = Math.pow(zoneWeight, 1.15) * Math.pow(crossWeight, 0.75);
    if (weight <= 0) {
      continue;
    }

    const stiffnessScale = 1.18 - vertex.stiffness;
    const amount = baseCrush * weight * stiffnessScale;
    const shear = (crossCoordinate(zone, vertex) - cross) * 0.045 * scaled * weight;
    vertex.x += zoneInward.x * amount;
    vertex.y += zoneInward.y * amount;
    if (zone === "front" || zone === "rear") {
      vertex.y += shear;
    } else {
      vertex.x += shear;
    }
    constrainFrameVertex(vertex, car.length, car.width);
    deformation += amount;
  }
  constrainFrameShape(frame, car.length, car.width);
  for (const scar of frame.scars) {
    keepScarOnShell(frame, scar);
  }

  const deformationScore = clamp01(deformation / Math.max(car.length, car.width));
  frame.crush[zone] = clamp01(frame.crush[zone] + deformationScore * 0.62);
  addCrumpleScars(frame, zone, localPoint, scaled, cross);
  return deformationScore;
}

function syntheticImpactForZone(
  car: Pick<Car, "length" | "width">,
  zone: DamageZone,
  amount: number,
): Vec2 {
  if (zone === "front") {
    return { x: car.length * 0.5, y: car.width * 0.12 };
  }
  if (zone === "rear") {
    return { x: -car.length * 0.5, y: -car.width * 0.08 };
  }
  if (zone === "left") {
    return { x: -car.length * 0.08 + amount * 10, y: -car.width * 0.5 };
  }
  return { x: car.length * 0.1 - amount * 10, y: car.width * 0.5 };
}

export function seedFrameFromBodyDamage(car: Car): void {
  const zones: DamageZone[] = ["front", "rear", "left", "right"];
  for (const zone of zones) {
    const amount = car.body[zone];
    if (amount <= 0.02) {
      continue;
    }
    const point = syntheticImpactForZone(car, zone, amount);
    const inward = zoneAxis(zone);
    applyFrameImpact(car, point, clamp01(amount * 1.15), zone, inward);
  }
}

export function repairCarFrame(
  frame: CarFrameState | null | undefined,
  amount: number,
): CarFrameState | null {
  if (!frame) {
    return null;
  }
  const repaired = cloneCarFrame(frame);
  const restore = clamp01(amount);
  for (const vertex of repaired.vertices) {
    vertex.x += (vertex.baseX - vertex.x) * restore;
    vertex.y += (vertex.baseY - vertex.y) * restore;
  }
  const baseLength =
    Math.max(...repaired.vertices.map((vertex) => Math.abs(vertex.baseX))) * 2;
  const baseWidth =
    Math.max(...repaired.vertices.map((vertex) => Math.abs(vertex.baseY))) * 2;
  constrainFrameShape(repaired, baseLength, baseWidth);
  repaired.crush.front = Math.max(0, repaired.crush.front - restore * 0.55);
  repaired.crush.rear = Math.max(0, repaired.crush.rear - restore * 0.55);
  repaired.crush.left = Math.max(0, repaired.crush.left - restore * 0.55);
  repaired.crush.right = Math.max(0, repaired.crush.right - restore * 0.55);
  repaired.scars = repaired.scars
    .map((scar) => ({
      ...scar,
      depth: scar.depth * (1 - restore * 0.72),
      width: scar.width * (1 - restore * 0.32),
    }))
    .filter((scar) => scar.depth > 0.07)
    .slice(-34);
  return repaired;
}

export function summarizeFrameDamage(frame: CarFrameState): {
  front: number;
  rear: number;
  left: number;
  right: number;
  scars: number;
} {
  return {
    front: Number(frame.crush.front.toFixed(2)),
    rear: Number(frame.crush.rear.toFixed(2)),
    left: Number(frame.crush.left.toFixed(2)),
    right: Number(frame.crush.right.toFixed(2)),
    scars: frame.scars.length,
  };
}
