import { getCarSystemPhases } from "../damage";
import type { Car } from "../types";

function drawLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = active ? color : "rgba(25, 20, 18, 0.82)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.2, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (active) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function traceCarBodyPath(ctx: CanvasRenderingContext2D, car: Car): void {
  ctx.beginPath();
  const [first, ...rest] = car.frame.vertices;
  ctx.moveTo(first.x, first.y);
  for (const vertex of rest) {
    ctx.lineTo(vertex.x, vertex.y);
  }
  ctx.closePath();
}

function traceRoofPanelPath(ctx: CanvasRenderingContext2D, car: Car): void {
  const crush = car.frame.crush;
  const skew = (crush.left - crush.right) * 5;
  const frontShorten = crush.front * 3;
  const rearShorten = crush.rear * 2;
  const widthLoss = Math.max(crush.left, crush.right) * 3.5;
  ctx.beginPath();
  ctx.moveTo(12 - frontShorten, -16 + widthLoss + skew);
  ctx.lineTo(15 - frontShorten, 0);
  ctx.lineTo(12 - frontShorten, 16 - widthLoss + skew);
  ctx.lineTo(-13 + rearShorten, 15 - widthLoss - skew);
  ctx.lineTo(-16 + rearShorten, 0);
  ctx.lineTo(-13 + rearShorten, -15 + widthLoss - skew);
  ctx.closePath();
}

function traceHoodPanelPath(ctx: CanvasRenderingContext2D, car: Car): void {
  const frontCrush = car.frame.crush.front;
  ctx.beginPath();
  ctx.moveTo(car.length * 0.17 - frontCrush * 12, -17);
  ctx.lineTo(car.length * 0.36 - frontCrush * 18, -12);
  ctx.lineTo(car.length * 0.34 - frontCrush * 20, 12);
  ctx.lineTo(car.length * 0.16 - frontCrush * 12, 17);
  ctx.closePath();
}

function traceWindshieldPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-7, -14);
  ctx.lineTo(2, -12);
  ctx.lineTo(1, 12);
  ctx.lineTo(-8, 14);
  ctx.closePath();
}

function drawRoofNumberDecal(ctx: CanvasRenderingContext2D, car: Car): void {
  const fontSize = Math.max(12, Math.min(18, car.length * 0.18));
  ctx.save();
  traceRoofPanelPath(ctx, car);
  ctx.clip();
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

function drawPanelSeams(ctx: CanvasRenderingContext2D, car: Car): void {
  const halfWidth = car.width * 0.46;
  const crush = car.frame.crush;
  const leftBodyEdge = -halfWidth + crush.left * 7;
  const rightBodyEdge = halfWidth - crush.right * 7;
  const leftCabinEdge = -15 + crush.left * 4;
  const rightCabinEdge = 15 - crush.right * 4;
  const frontDoorX = car.length * 0.08 - crush.front * 4;
  const rearDoorX = -car.length * 0.16 + crush.rear * 4;

  ctx.save();
  traceCarBodyPath(ctx, car);
  ctx.clip();
  ctx.strokeStyle = "rgba(28, 21, 18, 0.46)";
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  traceRoofPanelPath(ctx, car);
  ctx.stroke();
  traceHoodPanelPath(ctx, car);
  ctx.stroke();

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
  ctx.restore();
}

function drawPresetCharacterLines(
  ctx: CanvasRenderingContext2D,
  car: Car,
): void {
  const frontCrush = car.frame.crush.front;
  const rearCrush = car.frame.crush.rear;

  ctx.save();
  traceCarBodyPath(ctx, car);
  ctx.clip();
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
  ctx.restore();
}

function drawExposedCrush(ctx: CanvasRenderingContext2D, car: Car): void {
  const halfLength = car.length * 0.5;
  const halfWidth = car.width * 0.48;
  ctx.save();
  traceCarBodyPath(ctx, car);
  ctx.clip();
  const front = Math.max(car.body.front, car.frame.crush.front);
  const rear = Math.max(car.body.rear, car.frame.crush.rear);
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
  ctx.restore();
}

function drawCrumpleScars(ctx: CanvasRenderingContext2D, car: Car): void {
  if (car.frame.scars.length === 0) {
    return;
  }
  ctx.save();
  traceCarBodyPath(ctx, car);
  ctx.clip();
  ctx.lineCap = "round";
  for (const scar of car.frame.scars) {
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
  ctx.restore();
}

function drawDamageScrapes(ctx: CanvasRenderingContext2D, car: Car): void {
  const halfLength = car.length * 0.49;
  const halfWidth = car.width * 0.48;
  ctx.save();
  traceCarBodyPath(ctx, car);
  ctx.clip();

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

  ctx.restore();
  drawCrumpleScars(ctx, car);
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
  for (const axleX of [frontWheelX, rearWheelX]) {
    ctx.fillRect(
      axleX - axleWidth * 0.5,
      -wheelY,
      axleWidth,
      wheelY * 2,
    );
  }

  ctx.fillStyle = car.disabled ? "#3f3a36" : "#1f1510";
  for (const side of [-1, 1]) {
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

function getBodyEdge(car: Car): { front: number; rear: number } {
  return car.frame.vertices.reduce(
    (edges, vertex) => ({
      front: Math.max(edges.front, vertex.x),
      rear: Math.min(edges.rear, vertex.x),
    }),
    { front: -Infinity, rear: Infinity },
  );
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Car,
  options?: {
    showPlayerOutline?: boolean;
  },
): void {
  const showPlayerOutline = options?.showPlayerOutline ?? true;
  const phases = getCarSystemPhases(car);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (showPlayerOutline && car.isPlayer) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 244, 218, 0.72)";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(255, 229, 176, 0.42)";
    ctx.shadowBlur = 12;
    traceCarBodyPath(ctx, car);
    ctx.stroke();
    ctx.restore();
  }

  drawUndercarriage(ctx, car);

  const bodyGradient = ctx.createLinearGradient(
    -car.length * 0.5,
    0,
    car.length * 0.5,
    0,
  );
  bodyGradient.addColorStop(0, car.disabled ? "#4b443e" : "#2d2520");
  bodyGradient.addColorStop(0.18, car.disabled ? "#6f665f" : car.color);
  bodyGradient.addColorStop(0.72, car.disabled ? "#6a6058" : car.accent);
  bodyGradient.addColorStop(1, car.disabled ? "#3b3530" : "#221712");
  ctx.fillStyle = car.disabled ? "#6f665f" : bodyGradient;
  traceCarBodyPath(ctx, car);
  ctx.fill();
  drawExposedCrush(ctx, car);

  ctx.fillStyle =
    phases.engine === "critical" || car.disabled
      ? "rgba(63, 61, 58, 0.9)"
      : "rgba(118, 142, 150, 0.72)";
  traceRoofPanelPath(ctx, car);
  ctx.fill();

  ctx.fillStyle = car.disabled ? "#48423d" : "rgba(34, 28, 24, 0.9)";
  traceHoodPanelPath(ctx, car);
  ctx.fill();

  ctx.fillStyle = "rgba(210, 229, 232, 0.28)";
  traceWindshieldPath(ctx);
  ctx.fill();

  drawPanelSeams(ctx, car);
  drawPresetCharacterLines(ctx, car);

  ctx.strokeStyle = car.disabled ? "#3a3430" : "rgba(30, 17, 10, 0.78)";
  ctx.lineWidth = 3;
  traceCarBodyPath(ctx, car);
  ctx.stroke();

  drawDamageScrapes(ctx, car);
  drawRoofNumberDecal(ctx, car);

  const edges = getBodyEdge(car);
  drawLight(ctx, edges.front - 6, -15, car.lights.frontLeft, "#ffe9ac");
  drawLight(ctx, edges.front - 6, 15, car.lights.frontRight, "#ffe9ac");
  drawLight(ctx, edges.rear + 6, -14, car.lights.rearLeft, "#ff6245");
  drawLight(ctx, edges.rear + 6, 14, car.lights.rearRight, "#ff6245");

  ctx.restore();
}
