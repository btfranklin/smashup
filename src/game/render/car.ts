import { getSystemPhase } from "../damage";
import type { Car, Vec2 } from "../types";

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

type EndPanel = {
  path: Path2D;
  nearLeft: Vec2;
  nearRight: Vec2;
  farLeft: Vec2;
  farRight: Vec2;
  ridgeTop: Vec2;
  ridgeBottom: Vec2;
  ridge: Vec2;
  damage: number;
};

function createEndPanel(car: Car, zone: "front" | "rear"): EndPanel {
  const damage = Math.max(car.body[zone], car.frame.crush[zone]);
  const direction = zone === "front" ? 1 : -1;
  const nearX = car.length * (zone === "front" ? 0.17 : -0.2);
  const farX =
    car.length * (zone === "front" ? 0.35 : -0.42) -
    direction * damage * car.length * 0.045;
  const leftCorner = car.frame.vertices[zone === "front" ? 1 : 5];
  const rightCorner = car.frame.vertices[zone === "front" ? 12 : 8];
  const skew = (leftCorner.x - rightCorner.x) * direction * 0.3;
  const nearLeft = { x: nearX, y: -car.width * 0.3 };
  const nearRight = { x: nearX, y: car.width * 0.3 };
  const farLeft = { x: farX, y: -car.width * 0.22 };
  const farRight = { x: farX - direction * damage * 2, y: car.width * 0.22 };
  const ridgeX = (nearX + farX) * 0.5;
  const ridgeTop = { x: ridgeX, y: -car.width * 0.26 + damage * 4 };
  const ridgeBottom = { x: ridgeX, y: car.width * 0.26 + damage * 2 };
  const ridge = { x: ridgeX + direction * damage * 3, y: skew };
  const path = new Path2D();
  path.moveTo(nearLeft.x, nearLeft.y);
  path.lineTo(ridgeTop.x, ridgeTop.y);
  path.lineTo(farLeft.x, farLeft.y);
  path.lineTo(farRight.x, farRight.y);
  path.lineTo(ridgeBottom.x, ridgeBottom.y);
  path.lineTo(nearRight.x, nearRight.y);
  path.closePath();
  return {
    path,
    nearLeft,
    nearRight,
    farLeft,
    farRight,
    ridgeTop,
    ridgeBottom,
    ridge,
    damage,
  };
}

function drawEndPanelRelief(ctx: CanvasRenderingContext2D, panel: EndPanel): void {
  if (panel.damage <= 0.12) {
    return;
  }
  const { ridge, damage } = panel;
  ctx.fillStyle = `rgba(224, 208, 175, ${0.07 + damage * 0.2})`;
  ctx.beginPath();
  ctx.moveTo(panel.nearLeft.x, panel.nearLeft.y);
  ctx.lineTo(panel.ridgeTop.x, panel.ridgeTop.y);
  ctx.lineTo(panel.farLeft.x, panel.farLeft.y);
  ctx.lineTo(ridge.x, ridge.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(18, 17, 15, ${0.12 + damage * 0.28})`;
  ctx.beginPath();
  ctx.moveTo(panel.nearRight.x, panel.nearRight.y);
  ctx.lineTo(panel.ridgeBottom.x, panel.ridgeBottom.y);
  ctx.lineTo(panel.farRight.x, panel.farRight.y);
  ctx.lineTo(ridge.x, ridge.y);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1 + damage * 1.5;
  ctx.strokeStyle = `rgba(19, 17, 15, ${0.2 + damage * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(panel.ridgeTop.x, panel.ridgeTop.y);
  ctx.lineTo(ridge.x, ridge.y);
  ctx.lineTo(panel.ridgeBottom.x, panel.ridgeBottom.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(233, 220, 190, ${damage * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(panel.ridgeTop.x - 1, panel.ridgeTop.y);
  ctx.lineTo(ridge.x - 1, ridge.y);
  ctx.lineTo(panel.ridgeBottom.x - 1, panel.ridgeBottom.y);
  ctx.stroke();
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

    drawExposedChassis(ctx, car, "front");
    ctx.fillStyle = "#343634";
    ctx.beginPath();
    ctx.roundRect(car.length * 0.3, -10, car.length * 0.15, 20, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(176, 173, 152, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let index = 0; index < 3; index += 1) {
      const x = car.length * (0.32 + index * 0.035);
      ctx.moveTo(x, -8);
      ctx.lineTo(x, 8);
    }
    ctx.stroke();
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

    drawExposedChassis(ctx, car, "rear");
    ctx.strokeStyle = "rgba(162, 156, 137, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-car.length * 0.31, -car.width * 0.28);
    ctx.lineTo(-car.length * 0.31, car.width * 0.28);
    ctx.stroke();
  }
}

function drawCrumpleScars(ctx: CanvasRenderingContext2D, car: Car): void {
  ctx.lineCap = "round";
  for (
    let index = Math.max(0, car.frame.scars.length - 24);
    index < car.frame.scars.length;
    index += 1
  ) {
    const scar = car.frame.scars[index];
    const half = Math.min(scar.length, car.width * 0.65) * 0.5;
    const dx = Math.cos(scar.angle) * half;
    const dy = Math.sin(scar.angle) * half;
    const ridge = 1.5 + scar.depth * 3.5;
    const normalX = -Math.sin(scar.angle) * ridge;
    const normalY = Math.cos(scar.angle) * ridge;
    ctx.fillStyle = `rgba(218, 205, 175, ${0.12 + scar.depth * 0.22})`;
    ctx.beginPath();
    ctx.moveTo(scar.x - dx, scar.y - dy);
    ctx.lineTo(scar.x + normalX, scar.y + normalY);
    ctx.lineTo(scar.x + dx, scar.y + dy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(20, 18, 16, ${0.18 + scar.depth * 0.28})`;
    ctx.beginPath();
    ctx.moveTo(scar.x - dx, scar.y - dy);
    ctx.lineTo(scar.x - normalX, scar.y - normalY);
    ctx.lineTo(scar.x + dx, scar.y + dy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(22, 18, 16, ${0.24 + scar.depth * 0.42})`;
    ctx.lineWidth = Math.max(0.8, scar.width * 0.45);
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

function drawExposedChassis(
  ctx: CanvasRenderingContext2D,
  car: Car,
  zone: "front" | "rear",
): void {
  const direction = zone === "front" ? 1 : -1;
  const shoulderX = car.length * (zone === "front" ? 0.26 : 0.28) * direction;
  const nearX = car.length * 0.2 * direction;
  const farX = car.length * 0.34 * direction;
  const path = new Path2D();
  path.moveTo(farX, -car.width * 0.24);
  path.lineTo(shoulderX, -car.width * 0.35);
  path.lineTo(nearX, -car.width * 0.35);
  path.lineTo(nearX, car.width * 0.35);
  path.lineTo(shoulderX, car.width * 0.35);
  path.lineTo(farX, car.width * 0.24);
  path.closePath();
  ctx.fillStyle = "#393732";
  ctx.fill(path);
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

function drawCarUndercarriage(
  ctx: CanvasRenderingContext2D,
  car: Car,
): void {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  drawUndercarriage(ctx, car);
  ctx.restore();
}

function drawCarBody(
  ctx: CanvasRenderingContext2D,
  car: Car,
  showPlayerOutline: boolean,
): void {
  const { path: bodyPath, frontEdge, rearEdge } = createCarBodyPath(car);
  const roofPath = createRoofPanelPath(car);
  const hood = createEndPanel(car, "front");
  const trunk = createEndPanel(car, "rear");
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

  if (car.disabled) {
    ctx.fillStyle = car.color;
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
  if (car.disabled) {
    ctx.fillStyle = "rgba(65, 58, 49, 0.62)";
    ctx.fill(bodyPath);
  }

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
  ctx.fill(hood.path);
  drawEndPanelRelief(ctx, hood);
  if (trunk.damage > 0.12) {
    ctx.fillStyle = car.disabled ? "#4f4840" : "rgba(48, 35, 27, 0.65)";
    ctx.fill(trunk.path);
    drawEndPanelRelief(ctx, trunk);
  }

  ctx.fillStyle = "rgba(210, 229, 232, 0.28)";
  ctx.fill(getWindshieldPath());

  ctx.save();
  ctx.clip(bodyPath);
  drawPanelSeams(ctx, car, roofPath, hood.path);
  if (trunk.damage > 0.12) {
    ctx.stroke(trunk.path);
  }
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

export function drawCars(
  ctx: CanvasRenderingContext2D,
  cars: Car[],
  options?: {
    showPlayerOutline?: boolean;
  },
): void {
  for (const car of cars) {
    drawCarUndercarriage(ctx, car);
  }

  const showPlayerOutline = options?.showPlayerOutline ?? true;
  for (const car of cars) {
    drawCarBody(ctx, car, showPlayerOutline);
  }
}
