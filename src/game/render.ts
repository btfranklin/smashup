import { getActiveCars, getOutlastedDriverLabels, getPlayerCar, getWinnerCar } from "./selectors";
import type { Car, DebrisParticle, GameState, SmokePuff } from "./types";

function drawMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: number,
  fill: string,
): void {
  ctx.fillStyle = "#fff6da";
  ctx.font = "600 13px 'Trebuchet MS', sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "rgba(255, 240, 214, 0.16)";
  ctx.fillRect(x, y + 6, width, 9);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y + 6, Math.max(0, Math.min(width, width * value)), 9);
}

function drawArena(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wallPadding: number,
): void {
  const dirt = ctx.createLinearGradient(0, 0, 0, height);
  dirt.addColorStop(0, "#d8ad65");
  dirt.addColorStop(0.5, "#c88b46");
  dirt.addColorStop(1, "#8d5328");
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

function drawSmokePuffs(ctx: CanvasRenderingContext2D, puffs: SmokePuff[]): void {
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
      flameGradient.addColorStop(0, `rgba(255, 244, 186, ${life * puff.flame * 0.95})`);
      flameGradient.addColorStop(0.34, `rgba(255, 170, 64, ${life * puff.flame * 0.88})`);
      flameGradient.addColorStop(0.68, `rgba(214, 78, 22, ${life * puff.flame * 0.62})`);
      flameGradient.addColorStop(1, `rgba(28, 18, 16, ${life * puff.flame * 0.1})`);
      ctx.fillStyle = flameGradient;
      ctx.beginPath();
      ctx.arc(puff.x - radius * 0.06, puff.y - radius * 0.1, flameRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(150, 146, 138, ${smokeAlpha * 0.34 * (1 - puff.flame * 0.45)})`;
    ctx.beginPath();
    ctx.arc(puff.x + radius * 0.18, puff.y - radius * 0.1, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDebrisParticles(ctx: CanvasRenderingContext2D, particles: DebrisParticle[]): void {
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
    ctx.fillRect(-particle.size * 0.6, -particle.size * 0.35, particle.size * 1.2, particle.size * 0.7);
    ctx.fillStyle = `rgba(182, 154, 112, ${alpha * particle.tone})`;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawDamageScrapes(ctx: CanvasRenderingContext2D, car: Car): void {
  const scrapeColor = "rgba(33, 26, 22, 0.45)";
  ctx.strokeStyle = scrapeColor;
  ctx.lineWidth = 5;

  if (car.body.front > 0.12) {
    ctx.beginPath();
    ctx.moveTo(20, -18);
    ctx.lineTo(43, -8);
    ctx.moveTo(18, 18);
    ctx.lineTo(45, 8);
    ctx.stroke();
  }
  if (car.body.rear > 0.12) {
    ctx.beginPath();
    ctx.moveTo(-20, -16);
    ctx.lineTo(-42, -6);
    ctx.moveTo(-18, 16);
    ctx.lineTo(-41, 6);
    ctx.stroke();
  }
  if (car.body.left > 0.1) {
    ctx.beginPath();
    ctx.moveTo(-20, -24);
    ctx.lineTo(20, -24);
    ctx.stroke();
  }
  if (car.body.right > 0.1) {
    ctx.beginPath();
    ctx.moveTo(-20, 24);
    ctx.lineTo(20, 24);
    ctx.stroke();
  }
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
    ctx.fillRect(-wheelWidth * 0.5, -wheelHeight * 0.5, wheelWidth, wheelHeight);
    ctx.restore();
  }

  ctx.restore();
}

export function drawCar(ctx: CanvasRenderingContext2D, car: Car): void {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  const bodyGradient = ctx.createLinearGradient(-45, 0, 45, 0);
  bodyGradient.addColorStop(0, "#2d2018");
  bodyGradient.addColorStop(0.14, car.color);
  bodyGradient.addColorStop(0.86, car.accent);
  bodyGradient.addColorStop(1, "#221712");
  ctx.fillStyle = car.disabled ? "#6f665f" : bodyGradient;
  ctx.beginPath();
  ctx.roundRect(-42, -26, 84, 52, 16);
  ctx.fill();

  ctx.fillStyle = car.disabled ? "#4d4845" : "rgba(248, 232, 213, 0.82)";
  ctx.beginPath();
  ctx.roundRect(-8, -18, 28, 36, 10);
  ctx.fill();

  ctx.fillStyle = car.disabled ? "#60544e" : "#2b1910";
  ctx.beginPath();
  ctx.roundRect(18, -18, 16, 36, 7);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 244, 233, 0.35)";
  ctx.beginPath();
  ctx.roundRect(-5, -16, 11, 32, 5);
  ctx.fill();

  ctx.strokeStyle = car.disabled ? "#3a3430" : "rgba(30, 17, 10, 0.78)";
  ctx.lineWidth = 3;
  ctx.strokeRect(-39, -23, 78, 46);

  drawDamageScrapes(ctx, car);
  drawFrontWheels(ctx, car);

  drawLight(ctx, 36, -15, car.lights.frontLeft, "#ffe9ac");
  drawLight(ctx, 36, 15, car.lights.frontRight, "#ffe9ac");
  drawLight(ctx, -36, -15, car.lights.rearLeft, "#ff6245");
  drawLight(ctx, -36, 15, car.lights.rearRight, "#ff6245");

  if (car.isPlayer) {
    ctx.strokeStyle = "rgba(255, 245, 220, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(-46, -30, 92, 60);
  }

  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const player = getPlayerCar(state);
  if (!player) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(32, 18, 11, 0.68)";
  ctx.beginPath();
  ctx.roundRect(24, 24, 360, 136, 16);
  ctx.fill();

  ctx.fillStyle = "#fff6da";
  ctx.font = "700 26px 'Trebuchet MS', sans-serif";
  ctx.fillText(`Drivers Left: ${getActiveCars(state).length}`, 42, 58);

  drawMeter(ctx, 42, 78, 132, "Engine", player.systems.engine, "#d86e3f");
  drawMeter(ctx, 204, 78, 132, "Radiator", player.systems.radiator, "#78c9d6");
  drawMeter(ctx, 42, 112, 132, "Transmission", player.systems.transmission, "#dbc16a");
  drawMeter(ctx, 204, 112, 132, "Steering", player.systems.steering, "#c69ae8");

  ctx.fillStyle = "#fff6da";
  ctx.font = "600 13px 'Trebuchet MS', sans-serif";
  ctx.fillText(`Heat ${Math.round(player.systems.overheat * 100)}%`, 42, 146);
  ctx.fillStyle = "rgba(255, 240, 214, 0.16)";
  ctx.fillRect(96, 137, 240, 10);
  ctx.fillStyle = "#ff6d52";
  ctx.fillRect(96, 137, 240 * player.systems.overheat, 10);
  ctx.restore();
}

function drawMenuOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(25, 15, 7, 0.2)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawFinishOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const winner = getWinnerCar(state);
  const playerLost = getPlayerCar(state)?.disabled ?? false;
  const outlastedNames = getOutlastedDriverLabels(state);
  ctx.save();
  ctx.fillStyle = "rgba(18, 10, 3, 0.58)";
  ctx.fillRect(0, 0, state.arena.width, state.arena.height);
  ctx.fillStyle = "#fff3d3";
  ctx.font = "700 68px 'Trebuchet MS', sans-serif";
  ctx.fillText("Derby Over", state.arena.width * 0.5 - 180, state.arena.height * 0.42);
  ctx.font = "600 30px 'Trebuchet MS', sans-serif";
  const line = playerLost
    ? "Your car is done."
    : winner?.isPlayer
      ? "You survived the pileup."
      : `${winner?.label ?? "Nobody"} wins.`;
  ctx.fillText(line, state.arena.width * 0.5 - 170, state.arena.height * 0.5);
  if (playerLost) {
    ctx.font = "600 21px 'Trebuchet MS', sans-serif";
    ctx.fillText(
      `Outlasted by: ${outlastedNames.join(", ") || "nobody"}`,
      state.arena.width * 0.5 - 260,
      state.arena.height * 0.56,
    );
    ctx.fillText("Press R to restart", state.arena.width * 0.5 - 130, state.arena.height * 0.62);
  } else {
    ctx.fillText("Press R to restart", state.arena.width * 0.5 - 130, state.arena.height * 0.56);
  }
  ctx.restore();
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  drawArena(ctx, state.arena.width, state.arena.height, state.arena.wallPadding);
  drawDebrisParticles(ctx, state.debrisParticles);
  for (const car of state.cars) {
    drawCar(ctx, car);
  }
  drawSmokePuffs(ctx, state.smokePuffs);

  drawHud(ctx, state);

  if (state.mode === "menu") {
    drawMenuOverlay(ctx, state.arena.width, state.arena.height);
  } else if (state.mode === "finished") {
    drawFinishOverlay(ctx, state);
  }
}
