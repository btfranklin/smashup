import { getModifierSummary } from "./content";
import {
  getActiveCars,
  getOutlastedDriverLabels,
  getPlayerCar,
  getWinnerCar,
} from "./selectors";
import type {
  ArenaObject,
  Car,
  DamagePhase,
  DebrisParticle,
  DustPuff,
  EventMessage,
  GameState,
  MudZone,
  SmokePuff,
} from "./types";

function phaseColor(phase: DamagePhase, base: string): string {
  switch (phase) {
    case "healthy":
      return base;
    case "wounded":
      return "#e0c15b";
    case "failing":
      return "#ec8c41";
    case "critical":
      return "#e24a33";
  }
}

function drawMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: number,
  phase: DamagePhase,
  fill: string,
): void {
  ctx.fillStyle = "#fff6da";
  ctx.font = "600 13px 'Trebuchet MS', sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "rgba(255, 240, 214, 0.16)";
  ctx.fillRect(x, y + 6, width, 9);
  ctx.fillStyle = phaseColor(phase, fill);
  ctx.fillRect(x, y + 6, Math.max(0, Math.min(width, width * value)), 9);
}

function drawMudZones(
  ctx: CanvasRenderingContext2D,
  mudZones: MudZone[],
): void {
  ctx.save();
  for (const zone of mudZones) {
    const gradient = ctx.createLinearGradient(
      zone.x,
      zone.y,
      zone.x + zone.width,
      zone.y + zone.height,
    );
    gradient.addColorStop(0, "rgba(118, 79, 42, 0.32)");
    gradient.addColorStop(1, "rgba(74, 48, 22, 0.4)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(zone.x, zone.y, zone.width, zone.height, 38);
    ctx.fill();
    ctx.strokeStyle = "rgba(77, 47, 16, 0.24)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawArena(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height, wallPadding, mudZones, variant } = state.arena;
  const dirt = ctx.createLinearGradient(0, 0, 0, height);
  dirt.addColorStop(0, variant === "junkyard" ? "#d5a15d" : "#d8ad65");
  dirt.addColorStop(0.5, variant === "mud_pit" ? "#b97b39" : "#c88b46");
  dirt.addColorStop(1, variant === "junkyard" ? "#7c4b24" : "#8d5328");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 127.5) % width;
    const y = (i * 93.2) % height;
    ctx.fillStyle = i % 2 === 0 ? "#7e4d28" : "#e3bf79";
    ctx.beginPath();
    ctx.ellipse(x, y, 30 + (i % 5) * 18, 12 + (i % 3) * 8, i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (mudZones.length > 0) {
    drawMudZones(ctx, mudZones);
  }

  ctx.save();
  ctx.strokeStyle = "#f7e9b8";
  ctx.lineWidth = 28;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(
    wallPadding,
    wallPadding,
    width - wallPadding * 2,
    height - wallPadding * 2,
  );
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 247, 223, 0.18)";
  ctx.lineWidth = 4;
  const innerPadding = wallPadding + 56;
  ctx.strokeRect(
    innerPadding,
    innerPadding,
    width - innerPadding * 2,
    height - innerPadding * 2,
  );
  ctx.restore();
}

function drawArenaObject(
  ctx: CanvasRenderingContext2D,
  object: ArenaObject,
): void {
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.rotate(object.rotation);
  if (object.kind === "tire") {
    ctx.fillStyle = "#2c231d";
    ctx.beginPath();
    ctx.arc(0, 0, object.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9d8662";
    ctx.beginPath();
    ctx.arc(0, 0, object.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 236, 201, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = "#6c5a4a";
    ctx.beginPath();
    ctx.roundRect(
      -object.radius * 1.2,
      -object.radius * 0.8,
      object.radius * 2.4,
      object.radius * 1.6,
      8,
    );
    ctx.fill();
    ctx.fillStyle = "rgba(198, 164, 114, 0.5)";
    ctx.fillRect(
      -object.radius * 0.5,
      -object.radius * 0.22,
      object.radius * 1.1,
      object.radius * 0.44,
    );
  }
  ctx.restore();
}

function drawLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = active ? color : "rgba(25, 20, 18, 0.75)";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  if (active) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSmokePuffs(
  ctx: CanvasRenderingContext2D,
  puffs: SmokePuff[],
): void {
  if (puffs.length === 0) {
    return;
  }

  ctx.save();
  for (const puff of puffs) {
    const life = 1 - puff.age / puff.ttl;
    const radius = puff.size + (1 - life) * (12 + puff.density * 8);
    const smokeAlpha = life * (0.16 + puff.density * 0.34);
    const shellGradient = ctx.createRadialGradient(
      puff.x - radius * 0.2,
      puff.y - radius * 0.25,
      radius * 0.15,
      puff.x,
      puff.y,
      radius,
    );
    shellGradient.addColorStop(
      0,
      `rgba(${Math.round(118 - puff.density * 48)}, ${Math.round(114 - puff.density * 44)}, ${Math.round(108 - puff.density * 40)}, ${smokeAlpha * 0.8})`,
    );
    shellGradient.addColorStop(
      0.55,
      `rgba(${Math.round(72 - puff.density * 30)}, ${Math.round(68 - puff.density * 28)}, ${Math.round(64 - puff.density * 26)}, ${smokeAlpha})`,
    );
    shellGradient.addColorStop(1, `rgba(16, 14, 13, ${smokeAlpha * 0.82})`);
    ctx.fillStyle = shellGradient;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (puff.flame > 0.02) {
      const flameRadius = radius * (0.36 + puff.flame * 0.18) * life;
      const flameGradient = ctx.createRadialGradient(
        puff.x - radius * 0.24,
        puff.y - radius * 0.16,
        0,
        puff.x,
        puff.y,
        Math.max(flameRadius, 1),
      );
      flameGradient.addColorStop(
        0,
        `rgba(255, 244, 186, ${life * puff.flame * 0.95})`,
      );
      flameGradient.addColorStop(
        0.34,
        `rgba(255, 170, 64, ${life * puff.flame * 0.88})`,
      );
      flameGradient.addColorStop(
        0.68,
        `rgba(214, 78, 22, ${life * puff.flame * 0.62})`,
      );
      flameGradient.addColorStop(
        1,
        `rgba(28, 18, 16, ${life * puff.flame * 0.1})`,
      );
      ctx.fillStyle = flameGradient;
      ctx.beginPath();
      ctx.arc(
        puff.x - radius * 0.06,
        puff.y - radius * 0.1,
        flameRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDebrisParticles(
  ctx: CanvasRenderingContext2D,
  particles: DebrisParticle[],
): void {
  if (particles.length === 0) {
    return;
  }

  ctx.save();
  for (const particle of particles) {
    const life = 1 - particle.age / particle.ttl;
    const alpha = life * 0.85;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillStyle = `rgba(72, 64, 54, ${alpha})`;
    ctx.fillRect(
      -particle.size * 0.6,
      -particle.size * 0.35,
      particle.size * 1.2,
      particle.size * 0.7,
    );
    ctx.fillStyle = `rgba(182, 154, 112, ${alpha * particle.tone})`;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawDustPuffs(ctx: CanvasRenderingContext2D, puffs: DustPuff[]): void {
  if (puffs.length === 0) {
    return;
  }
  ctx.save();
  for (const puff of puffs) {
    const life = 1 - puff.age / puff.ttl;
    const radius = puff.size + (1 - life) * 10;
    const alpha = puff.alpha * life;
    ctx.fillStyle = `rgba(${Math.round(188 * puff.tone)}, ${Math.round(144 * puff.tone)}, 88, ${alpha})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function traceCarBodyPath(ctx: CanvasRenderingContext2D, car: Car): void {
  ctx.beginPath();
  ctx.roundRect(
    -car.length * 0.49,
    -car.width * 0.48,
    car.length * 0.98,
    car.width * 0.96,
    16,
  );
}

function traceRoofPanelPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.roundRect(-12, -17, 24, 34, 9);
}

function drawRoofNumberDecal(ctx: CanvasRenderingContext2D, car: Car): void {
  const fontSize = Math.max(12, Math.min(18, car.length * 0.18));
  ctx.save();
  traceRoofPanelPath(ctx);
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
}

function drawFrontWheels(ctx: CanvasRenderingContext2D, car: Car): void {
  const wheelX = 18;
  const wheelY = 22;
  const wheelWidth = 16;
  const wheelHeight = 7;
  ctx.save();
  ctx.fillStyle = car.disabled ? "#3f3a36" : "#1f1510";

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(wheelX, wheelY * side);
    ctx.rotate(car.steerAngle * 0.9);
    ctx.fillRect(
      -wheelWidth * 0.5,
      -wheelHeight * 0.5,
      wheelWidth,
      wheelHeight,
    );
    ctx.restore();
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
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  const bodyGradient = ctx.createLinearGradient(-45, 0, 45, 0);
  bodyGradient.addColorStop(0, "#2d2018");
  bodyGradient.addColorStop(0.14, car.color);
  bodyGradient.addColorStop(0.86, car.accent);
  bodyGradient.addColorStop(1, "#221712");
  ctx.fillStyle = car.disabled ? "#6f665f" : bodyGradient;
  traceCarBodyPath(ctx, car);
  ctx.fill();

  ctx.fillStyle =
    car.phases.engine === "critical" || car.disabled
      ? "rgba(88, 82, 78, 0.88)"
      : "rgba(248, 232, 213, 0.82)";
  traceRoofPanelPath(ctx);
  ctx.fill();

  ctx.fillStyle = car.disabled ? "#60544e" : "#2b1910";
  ctx.beginPath();
  ctx.roundRect(16, -18, 18, 36, 7);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 244, 233, 0.35)";
  ctx.beginPath();
  ctx.roundRect(-7, -15, 7, 30, 4);
  ctx.fill();

  ctx.strokeStyle = car.disabled ? "#3a3430" : "rgba(30, 17, 10, 0.78)";
  ctx.lineWidth = 3;
  traceCarBodyPath(ctx, car);
  ctx.stroke();

  drawDamageScrapes(ctx, car);
  drawRoofNumberDecal(ctx, car);
  drawFrontWheels(ctx, car);

  drawLight(ctx, 36, -15, car.lights.frontLeft, "#ffe9ac");
  drawLight(ctx, 36, 15, car.lights.frontRight, "#ffe9ac");
  drawLight(ctx, -36, -15, car.lights.rearLeft, "#ff6245");
  drawLight(ctx, -36, 15, car.lights.rearRight, "#ff6245");

  if (showPlayerOutline && car.isPlayer) {
    ctx.strokeStyle = "rgba(255, 245, 220, 0.82)";
    ctx.lineWidth = 3;
    ctx.strokeRect(-46, -30, 92, 60);
  }

  ctx.restore();
}

function drawPreviewBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#efe5d4");
  background.addColorStop(1, "#c6b090");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.fillStyle = "rgba(53, 36, 18, 0.08)";
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.58, 210, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const player = getPlayerCar(state);
  if (!player) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(32, 18, 11, 0.7)";
  ctx.beginPath();
  ctx.roundRect(24, 24, 404, 184, 16);
  ctx.fill();

  ctx.fillStyle = "#fff6da";
  ctx.font = "700 26px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    `Round ${state.session.roundIndex + 1}/${state.session.totalRounds}`,
    42,
    56,
  );
  ctx.font = "600 16px 'Trebuchet MS', sans-serif";
  ctx.fillText(state.arena.title, 42, 78);
  ctx.fillText(getModifierSummary(state.arena.modifier), 250, 78);

  drawMeter(
    ctx,
    42,
    102,
    152,
    "Engine",
    player.systems.engine,
    player.phases.engine,
    "#d86e3f",
  );
  drawMeter(
    ctx,
    226,
    102,
    152,
    "Radiator",
    player.systems.radiator,
    player.phases.radiator,
    "#78c9d6",
  );
  drawMeter(
    ctx,
    42,
    136,
    152,
    "Transmission",
    player.systems.transmission,
    player.phases.transmission,
    "#dbc16a",
  );
  drawMeter(
    ctx,
    226,
    136,
    152,
    "Steering",
    player.systems.steering,
    player.phases.steering,
    "#c69ae8",
  );

  ctx.fillStyle = "#fff6da";
  ctx.font = "600 13px 'Trebuchet MS', sans-serif";
  ctx.fillText(`Heat ${Math.round(player.systems.overheat * 100)}%`, 42, 172);
  ctx.fillStyle = "rgba(255, 240, 214, 0.16)";
  ctx.fillRect(96, 163, 282, 10);
  ctx.fillStyle =
    player.systems.overheat > 0.75
      ? "#ff4d31"
      : player.systems.overheat > 0.45
        ? "#ff9954"
        : "#ffcf6a";
  ctx.fillRect(96, 163, 282 * player.systems.overheat, 10);

  ctx.font = "700 18px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#fff0c7";
  ctx.fillText(`Drivers Left: ${getActiveCars(state).length}`, 42, 198);
  ctx.restore();
}

function drawEventFeed(
  ctx: CanvasRenderingContext2D,
  events: EventMessage[],
): void {
  if (events.length === 0) {
    return;
  }
  const active = events.slice(-3);
  ctx.save();
  ctx.textAlign = "center";
  active.forEach((event, index) => {
    const y = 130 + index * 32;
    const alpha = Math.min(1, event.ttl / 0.5) * 0.95;
    ctx.fillStyle = `rgba(22, 12, 8, ${alpha * 0.55})`;
    ctx.beginPath();
    ctx.roundRect(480, y - 20, 540, 28, 10);
    ctx.fill();
    ctx.fillStyle =
      event.kind === "system"
        ? "#ffd989"
        : event.kind === "warning"
          ? "#ffb760"
          : event.kind === "result"
            ? "#fff0bc"
            : "#fff8d8";
    ctx.font = `${600 + Math.round(event.emphasis * 140)} 20px 'Trebuchet MS', sans-serif`;
    ctx.fillText(event.text, 750, y);
  });
  ctx.restore();
}

function drawIntroOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(20, 12, 5, 0.48)";
  ctx.fillRect(0, 0, state.arena.width, state.arena.height);
  ctx.fillStyle = "#fff0cb";
  ctx.textAlign = "center";
  ctx.font = "700 70px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    state.arena.title,
    state.arena.width * 0.5,
    state.arena.height * 0.36,
  );
  ctx.font = "600 26px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    state.arena.introLine,
    state.arena.width * 0.5,
    state.arena.height * 0.42,
  );
  ctx.font = "700 34px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    getModifierSummary(state.arena.modifier),
    state.arena.width * 0.5,
    state.arena.height * 0.49,
  );
  const countdown = Math.max(1, Math.ceil(state.session.countdown));
  ctx.font = "700 110px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    String(countdown),
    state.arena.width * 0.5,
    state.arena.height * 0.66,
  );
  ctx.restore();
}

function drawNonRunningOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(25, 15, 7, 0.22)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  ctx.clearRect(0, 0, state.arena.width, state.arena.height);

  if (state.mode === "car_preview") {
    drawPreviewBackground(ctx, state.arena.width, state.arena.height);
    const previewCar = state.cars[0];
    const previewScale = 3.4;
    ctx.save();
    ctx.translate(state.arena.width * 0.5, state.arena.height * 0.52);
    ctx.scale(previewScale, previewScale);
    ctx.translate(-previewCar.x, -previewCar.y);
    for (const car of state.cars) {
      drawCar(ctx, car, { showPlayerOutline: false });
    }
    drawSmokePuffs(ctx, state.smokePuffs);
    ctx.restore();
    return;
  }

  const shakeX =
    Math.sin(state.tick * 0.8) * state.camera.shake * 0.5 +
    state.camera.nudgeX * 0.7;
  const shakeY =
    Math.cos(state.tick * 0.9) * state.camera.shake * 0.3 +
    state.camera.nudgeY * 0.7;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawArena(ctx, state);
  for (const object of state.arena.objects) {
    drawArenaObject(ctx, object);
  }
  drawDustPuffs(ctx, state.dustPuffs);
  drawDebrisParticles(ctx, state.debrisParticles);
  for (const car of state.cars) {
    drawCar(ctx, car);
  }
  drawSmokePuffs(ctx, state.smokePuffs);
  ctx.restore();

  drawHud(ctx, state);
  drawEventFeed(ctx, state.events);

  if (state.mode === "intro") {
    drawIntroOverlay(ctx, state);
  } else if (state.mode !== "running") {
    drawNonRunningOverlay(ctx, state.arena.width, state.arena.height);
  }
}
