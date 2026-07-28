import { getSystemPhase } from "../damage";
import type { Car } from "../types";

let windshieldPath: Path2D | undefined;

function drawLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  color: string,
): void {
  ctx.fillStyle = active ? color : "rgba(25, 20, 18, 0.82)";
  ctx.beginPath();
  ctx.ellipse(x, y, 3.2, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (active) {
    const inheritedShadowColor = ctx.shadowColor;
    const inheritedShadowBlur = ctx.shadowBlur;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = inheritedShadowColor;
    ctx.shadowBlur = inheritedShadowBlur;
  }
}

function drawLights(
  ctx: CanvasRenderingContext2D,
  car: Car,
  frontEdge: number,
  rearEdge: number,
): void {
  ctx.save();
  drawLight(ctx, frontEdge - 6, -15, car.lights.frontLeft, "#ffe9ac");
  drawLight(ctx, frontEdge - 6, 15, car.lights.frontRight, "#ffe9ac");
  drawLight(ctx, rearEdge + 6, -14, car.lights.rearLeft, "#ff6245");
  drawLight(ctx, rearEdge + 6, 14, car.lights.rearRight, "#ff6245");
  ctx.restore();
}

function createCarBodyPath(car: Car): {
  path: Path2D;
  frontEdge: number;
  rearEdge: number;
} {
  const path = new Path2D();
  const vertices = car.frame.vertices;
  const first = vertices[0];
  let frontEdge = first.x;
  let rearEdge = first.x;
  path.moveTo(first.x, first.y);
  for (let index = 1; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    path.lineTo(vertex.x, vertex.y);
    frontEdge = Math.max(frontEdge, vertex.x);
    rearEdge = Math.min(rearEdge, vertex.x);
  }
  path.closePath();
  return { path, frontEdge, rearEdge };
}

function createRoofPanelPath(car: Car): Path2D {
  const crush = car.frame.crush;
  const skew = (crush.left - crush.right) * 5;
  const frontShorten = crush.front * 3;
  const rearShorten = crush.rear * 2;
  const widthLoss = Math.max(crush.left, crush.right) * 3.5;
  const path = new Path2D();
  path.moveTo(12 - frontShorten, -16 + widthLoss + skew);
  path.lineTo(15 - frontShorten, 0);
  path.lineTo(12 - frontShorten, 16 - widthLoss + skew);
  path.lineTo(-13 + rearShorten, 15 - widthLoss - skew);
  path.lineTo(-16 + rearShorten, 0);
  path.lineTo(-13 + rearShorten, -15 + widthLoss - skew);
  path.closePath();
  return path;
}

function createHoodPanelPath(car: Car): Path2D {
  const frontCrush = car.frame.crush.front;
  const path = new Path2D();
  path.moveTo(car.length * 0.17 - frontCrush * 12, -17);
  path.lineTo(car.length * 0.36 - frontCrush * 18, -12);
  path.lineTo(car.length * 0.34 - frontCrush * 20, 12);
  path.lineTo(car.length * 0.16 - frontCrush * 12, 17);
  path.closePath();
  return path;
}

function getWindshieldPath(): Path2D {
  if (!windshieldPath) {
    windshieldPath = new Path2D();
    windshieldPath.moveTo(-7, -14);
    windshieldPath.lineTo(2, -12);
    windshieldPath.lineTo(1, 12);
    windshieldPath.lineTo(-8, 14);
    windshieldPath.closePath();
  }
  return windshieldPath;
}

function drawRoofNumberDecal(
  ctx: CanvasRenderingContext2D,
  car: Car,
  roofPath: Path2D,
): void {
  const fontSize = Math.max(12, Math.min(18, car.length * 0.18));
  ctx.save();
  ctx.clip(roofPath);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px 'Trebuchet MS', sans-serif`;
  ctx.lineWidth = Math.max(2.6, fontSize * 0.22);
  ctx.strokeStyle = "rgba(74, 48, 28, 0.42)";
  ctx.fillStyle = car.disabled
    ? "rgba(182, 171, 157, 0.8)"
    : "rgba(246, 236, 220, 0.9)";
  ctx.strokeText(car.roofNumber, 0, 0);
  ctx.fillText(car.roofNumber, 0, 0);
  ctx.restore();
}

function drawPanelSeams(
  ctx: CanvasRenderingContext2D,
  car: Car,
  roofPath: Path2D,
  hoodPath: Path2D,
): void {
  const halfWidth = car.width * 0.46;
  const crush = car.frame.crush;
  const leftBodyEdge = -halfWidth + crush.left * 7;
  const rightBodyEdge = halfWidth - crush.right * 7;
  const leftCabinEdge = -15 + crush.left * 4;
  const rightCabinEdge = 15 - crush.right * 4;
  const frontDoorX = car.length * 0.08 - crush.front * 4;
  const rearDoorX = -car.length * 0.16 + crush.rear * 4;

  ctx.strokeStyle = "rgba(28, 21, 18, 0.46)";
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.stroke(roofPath);
  ctx.stroke(hoodPath);

  ctx.beginPath();
  ctx.moveTo(frontDoorX + 2, leftBodyEdge);
  ctx.lineTo(frontDoorX, leftCabinEdge);
  ctx.moveTo(frontDoorX, rightCabinEdge);
  ctx.lineTo(frontDoorX + 2, rightBodyEdge);
  ctx.moveTo(rearDoorX - 2, leftBodyEdge);
  ctx.lineTo(rearDoorX, leftCabinEdge);
  ctx.moveTo(rearDoorX, rightCabinEdge);
  ctx.lineTo(rearDoorX - 2, rightBodyEdge);
  ctx.stroke();
}

function drawPresetCharacterLines(
  ctx: CanvasRenderingContext2D,
  car: Car,
): void {
  const frontCrush = car.frame.crush.front;
  const rearCrush = car.frame.crush.rear;

  ctx.strokeStyle = car.disabled ? "rgba(174, 164, 151, 0.42)" : car.accent;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  switch (car.presetId) {
    case "bulldozer": {
      const start = car.length * 0.2 - frontCrush * 9;
      const end = car.length * 0.41 - frontCrush * 18;
      ctx.moveTo(start, -6);
      ctx.lineTo(end, -6);
      ctx.moveTo(start, 6);
      ctx.lineTo(end, 6);
      break;
    }
    case "darter": {
      const start = car.length * 0.16 - frontCrush * 8;
      const point = car.length * 0.41 - frontCrush * 18;
      ctx.moveTo(start, -8);
      ctx.lineTo(point, 0);
      ctx.lineTo(start, 8);
      break;
    }
    case "backstab": {
      const start = -car.length * 0.2 + rearCrush * 7;
      const point = -car.length * 0.42 + rearCrush * 17;
      ctx.moveTo(start, -9);
      ctx.lineTo(point, 0);
      ctx.lineTo(start, 9);
      break;
    }
  }

  ctx.stroke();
}

function drawExposedCrush(
  ctx: CanvasRenderingContext2D,
  car: Car,
  front: number,
  rear: number,
): void {
  const halfLength = car.length * 0.5;
  const halfWidth = car.width * 0.48;
  if (front > 0.28) {
    const depth = 8 + front * 22;
    ctx.fillStyle = `rgba(24, 21, 19, ${0.2 + front * 0.34})`;
    ctx.beginPath();
    ctx.moveTo(halfLength - depth, -halfWidth * 0.68);
    ctx.lineTo(halfLength + 4, -halfWidth * 0.42);
    ctx.lineTo(halfLength + 4, halfWidth * 0.42);
    ctx.lineTo(halfLength - depth * 0.78, halfWidth * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  if (rear > 0.32) {
    const depth = 7 + rear * 19;
    ctx.fillStyle = `rgba(29, 25, 22, ${0.16 + rear * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(-halfLength + depth, -halfWidth * 0.6);
    ctx.lineTo(-halfLength - 4, -halfWidth * 0.36);
    ctx.lineTo(-halfLength - 4, halfWidth * 0.36);
    ctx.lineTo(-halfLength + depth * 0.82, halfWidth * 0.62);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrumpleScars(ctx: CanvasRenderingContext2D, car: Car): void {
  ctx.lineCap = "round";
  for (let index = 0; index < car.frame.scars.length; index += 1) {
    const scar = car.frame.scars[index];
    const half = scar.length * 0.5;
    const dx = Math.cos(scar.angle) * half;
    const dy = Math.sin(scar.angle) * half;
    ctx.strokeStyle = `rgba(22, 18, 16, ${0.2 + scar.depth * 0.48})`;
    ctx.lineWidth = scar.width;
    ctx.beginPath();
    ctx.moveTo(scar.x - dx, scar.y - dy);
    ctx.lineTo(scar.x + dx, scar.y + dy);
    ctx.stroke();
    ctx.strokeStyle = `rgba(221, 207, 184, ${0.08 + scar.depth * 0.12})`;
    ctx.lineWidth = Math.max(0.8, scar.width * 0.36);
    ctx.beginPath();
    ctx.moveTo(
      scar.x - dx * 0.7 + dy * 0.12,
      scar.y - dy * 0.7 - dx * 0.12,
    );
    ctx.lineTo(
      scar.x + dx * 0.45 + dy * 0.12,
      scar.y + dy * 0.45 - dx * 0.12,
    );
    ctx.stroke();
  }
}

function drawDamageScrapes(ctx: CanvasRenderingContext2D, car: Car): void {
  const halfLength = car.length * 0.49;
  const halfWidth = car.width * 0.48;

  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(33, 26, 22, 0.58)";
  ctx.lineWidth = 4.5;

  if (car.body.front > 0.08) {
    const inset = 8 + car.body.front * 16;
    ctx.fillStyle = `rgba(26, 18, 13, ${0.12 + car.body.front * 0.18})`;
    ctx.beginPath();
    ctx.moveTo(halfLength - inset, -halfWidth + 6);
    ctx.lineTo(halfLength + 10, -halfWidth + 16);
    ctx.lineTo(halfLength + 10, halfWidth - 16);
    ctx.lineTo(halfLength - inset, halfWidth - 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(halfLength - inset - 8, -14);
    ctx.lineTo(halfLength - 10, -6);
    ctx.moveTo(halfLength - inset - 10, 12);
    ctx.lineTo(halfLength - 8, 5);
    ctx.stroke();
  }

  if (car.body.rear > 0.08) {
    const inset = 8 + car.body.rear * 15;
    ctx.fillStyle = `rgba(28, 20, 14, ${0.1 + car.body.rear * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(-halfLength + inset, -halfWidth + 7);
    ctx.lineTo(-halfLength - 8, -halfWidth + 18);
    ctx.lineTo(-halfLength - 8, halfWidth - 18);
    ctx.lineTo(-halfLength + inset, halfWidth - 7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-halfLength + inset + 2, -12);
    ctx.lineTo(-halfLength + 10, -4);
    ctx.moveTo(-halfLength + inset - 2, 11);
    ctx.lineTo(-halfLength + 12, 4);
    ctx.stroke();
  }

  if (car.body.left > 0.08) {
    const band = 6 + car.body.left * 10;
    ctx.fillStyle = `rgba(30, 22, 16, ${0.1 + car.body.left * 0.16})`;
    ctx.fillRect(-halfLength + 10, -halfWidth - 2, car.length - 20, band + 4);
    ctx.beginPath();
    ctx.moveTo(-18, -halfWidth + 7);
    ctx.lineTo(18, -halfWidth + band - 1);
    ctx.stroke();
  }

  if (car.body.right > 0.08) {
    const band = 6 + car.body.right * 10;
    ctx.fillStyle = `rgba(30, 22, 16, ${0.1 + car.body.right * 0.16})`;
    ctx.fillRect(
      -halfLength + 10,
      halfWidth - band - 2,
      car.length - 20,
      band + 4,
    );
    ctx.beginPath();
    ctx.moveTo(-18, halfWidth - 7);
    ctx.lineTo(18, halfWidth - band + 1);
    ctx.stroke();
  }
}

function drawUndercarriage(ctx: CanvasRenderingContext2D, car: Car): void {
  const frontWheelX = car.length * 0.2;
  const rearWheelX = -car.length * 0.28;
  const wheelY = car.width * 0.48;
  const wheelWidth = 16;
  const wheelHeight = 8;
  const axleWidth = 4;
  ctx.save();

  ctx.fillStyle = car.disabled ? "#201c19" : "#11100f";
  ctx.fillRect(
    frontWheelX - axleWidth * 0.5,
    -wheelY,
    axleWidth,
    wheelY * 2,
  );
  ctx.fillRect(
    rearWheelX - axleWidth * 0.5,
    -wheelY,
    axleWidth,
    wheelY * 2,
  );

  ctx.fillStyle = car.disabled ? "#3f3a36" : "#1f1510";
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(frontWheelX, wheelY * side);
    ctx.rotate(car.steerAngle * 0.9);
    ctx.fillRect(
      -wheelWidth * 0.5,
      -wheelHeight * 0.5,
      wheelWidth,
      wheelHeight,
    );
    ctx.restore();
    ctx.fillRect(
      rearWheelX - wheelWidth * 0.5,
      wheelY * side - wheelHeight * 0.5,
      wheelWidth,
      wheelHeight,
    );
  }

  ctx.restore();
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Car,
  options?: {
    showPlayerOutline?: boolean;
  },
): void {
  const showPlayerOutline = options?.showPlayerOutline ?? true;
  const { path: bodyPath, frontEdge, rearEdge } = createCarBodyPath(car);
  const roofPath = createRoofPanelPath(car);
  const hoodPath = createHoodPanelPath(car);
  const frontCrush = Math.max(car.body.front, car.frame.crush.front);
  const rearCrush = Math.max(car.body.rear, car.frame.crush.rear);
  const hasExposedCrush = frontCrush > 0.28 || rearCrush > 0.32;
  const hasDamageScrapes =
    car.body.front > 0.08 ||
    car.body.rear > 0.08 ||
    car.body.left > 0.08 ||
    car.body.right > 0.08;
  const hasCrumpleScars = car.frame.scars.length > 0;
  const enginePhase = getSystemPhase(car.systems.engine);

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (showPlayerOutline && car.isPlayer) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 244, 218, 0.72)";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(255, 229, 176, 0.42)";
    ctx.shadowBlur = 12;
    ctx.stroke(bodyPath);
    ctx.restore();
  }

  drawUndercarriage(ctx, car);

  if (car.disabled) {
    ctx.fillStyle = "#6f665f";
  } else {
    const bodyGradient = ctx.createLinearGradient(
      -car.length * 0.5,
      0,
      car.length * 0.5,
      0,
    );
    bodyGradient.addColorStop(0, "#2d2520");
    bodyGradient.addColorStop(0.18, car.color);
    bodyGradient.addColorStop(0.72, car.accent);
    bodyGradient.addColorStop(1, "#221712");
    ctx.fillStyle = bodyGradient;
  }
  ctx.fill(bodyPath);

  if (hasExposedCrush) {
    ctx.save();
    ctx.clip(bodyPath);
    drawExposedCrush(ctx, car, frontCrush, rearCrush);
    ctx.restore();
  }

  ctx.fillStyle =
    enginePhase === "critical" || car.disabled
      ? "rgba(63, 61, 58, 0.9)"
      : "rgba(118, 142, 150, 0.72)";
  ctx.fill(roofPath);

  ctx.fillStyle = car.disabled ? "#48423d" : "rgba(34, 28, 24, 0.9)";
  ctx.fill(hoodPath);

  ctx.fillStyle = "rgba(210, 229, 232, 0.28)";
  ctx.fill(getWindshieldPath());

  ctx.save();
  ctx.clip(bodyPath);
  drawPanelSeams(ctx, car, roofPath, hoodPath);
  drawPresetCharacterLines(ctx, car);
  ctx.restore();

  ctx.strokeStyle = car.disabled ? "#3a3430" : "rgba(30, 17, 10, 0.78)";
  ctx.lineWidth = 3;
  ctx.stroke(bodyPath);

  if (hasDamageScrapes || hasCrumpleScars) {
    ctx.save();
    ctx.clip(bodyPath);
    if (hasDamageScrapes) {
      drawDamageScrapes(ctx, car);
    }
    if (hasCrumpleScars) {
      drawCrumpleScars(ctx, car);
    }
    ctx.restore();
  }

  drawRoofNumberDecal(ctx, car, roofPath);
  drawLights(ctx, car, frontEdge, rearEdge);

  ctx.restore();
}
