import { getModifierSummary } from "../content";
import { getCarSystemPhases } from "../damage";
import { getActiveCars, getPlayerCar } from "../selectors";
import type { DamagePhase, EventMessage, GameState } from "../types";

export function getPhaseColor(phase: DamagePhase, base: string): string {
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
  ctx.fillStyle = getPhaseColor(phase, fill);
  ctx.fillRect(x, y + 6, Math.max(0, Math.min(width, width * value)), 9);
}

export function drawPreviewBackground(
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

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const player = getPlayerCar(state);
  const plan = state.currentRoundPlan;
  if (!player || !plan) {
    return;
  }
  const phases = getCarSystemPhases(player);

  ctx.save();
  ctx.fillStyle = "rgba(32, 18, 11, 0.7)";
  ctx.beginPath();
  ctx.roundRect(24, 24, 404, 184, 16);
  ctx.fill();

  ctx.fillStyle = "#fff6da";
  ctx.font = "700 26px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    `Round ${plan.id}/${state.session.roundPlans.length}`,
    42,
    56,
  );
  ctx.font = "600 16px 'Trebuchet MS', sans-serif";
  ctx.fillText(plan.title, 42, 78);
  ctx.fillText(getModifierSummary(plan.modifier), 250, 78);

  drawMeter(
    ctx,
    42,
    102,
    152,
    "Engine",
    player.systems.engine,
    phases.engine,
    "#d86e3f",
  );
  drawMeter(
    ctx,
    226,
    102,
    152,
    "Radiator",
    player.systems.radiator,
    phases.radiator,
    "#78c9d6",
  );
  drawMeter(
    ctx,
    42,
    136,
    152,
    "Transmission",
    player.systems.transmission,
    phases.transmission,
    "#dbc16a",
  );
  drawMeter(
    ctx,
    226,
    136,
    152,
    "Steering",
    player.systems.steering,
    phases.steering,
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

export function drawEventFeed(
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

export function drawIntroOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const plan = state.currentRoundPlan;
  if (!plan) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(20, 12, 5, 0.48)";
  ctx.fillRect(0, 0, state.arena.width, state.arena.height);
  ctx.fillStyle = "#fff0cb";
  ctx.textAlign = "center";
  ctx.font = "700 70px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    plan.title,
    state.arena.width * 0.5,
    state.arena.height * 0.36,
  );
  ctx.font = "600 26px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    plan.introLine,
    state.arena.width * 0.5,
    state.arena.height * 0.42,
  );
  ctx.font = "700 34px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    getModifierSummary(plan.modifier),
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

export function drawNonRunningOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(25, 15, 7, 0.22)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
