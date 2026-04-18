import "./style.css";

import { AudioManager } from "./game/audio";
import { advanceState, applyPlayerControls, createInitialState, renderGameToText, restartState, startMatch } from "./game/game";
import { renderGame } from "./game/render";
import { getOutlastedDriverLabels, getPlayerCar, getWinnerCar } from "./game/selectors";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root missing.");
}

const state = createInitialState();
const audio = new AudioManager();
const frame = document.createElement("div");
frame.className = "frame";

const canvas = document.createElement("canvas");
canvas.width = state.arena.width;
canvas.height = state.arena.height;
canvas.setAttribute("aria-label", "Smashup Derby arena");

const menu = document.createElement("section");
menu.className = "menu";

frame.append(canvas, menu);
app.append(frame);

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D canvas context unavailable.");
}

const input = {
  left: false,
  right: false,
  forward: false,
  reverse: false,
};
const automatedStepping = navigator.webdriver;

function renderMenuContent(): void {
  const desiredMode = state.mode === "finished" ? "finished" : "menu";
  if (menu.dataset.mode === desiredMode) {
    return;
  }
  menu.dataset.mode = desiredMode;

  if (state.mode === "finished") {
    const winner = getWinnerCar(state);
    const playerLost = getPlayerCar(state)?.disabled ?? false;
    const outlastedList = getOutlastedDriverLabels(state).join(", ");
    menu.innerHTML = `
      <h1>Derby<br />Over</h1>
      <h2>${
        playerLost
          ? "Your engine quit first."
          : winner?.isPlayer
            ? "You stayed moving."
            : `${winner?.label ?? "Nobody"} outlasted the field.`
      }</h2>
      <p>${
        playerLost
          ? `Drivers still rolling: ${outlastedList || "nobody"}.`
          : "Restart for another eight-car slugfest."
      }</p>
      <button id="start-btn" type="button">Restart Derby</button>
      <p class="hint">Press R or click restart.</p>
    `;
    menu.querySelector<HTMLButtonElement>("#start-btn")?.addEventListener("click", restartMatch);
    return;
  }

  menu.innerHTML = `
    <h1>Smashup<br />Derby</h1>
    <h2>Reverse Hard. Survive Longer.</h2>
    <p>Eight cars. One dirt bowl. Your engine only lives as long as your nose stays out of trouble.</p>
    <p>Controls: steer with W/A/S/D or arrows, reverse for the big hits, press F for fullscreen.</p>
    <button id="start-btn" type="button">Start Derby</button>
    <p class="hint">Last drivable car wins. Press Enter to start and R to restart after the wrecks settle.</p>
  `;
  menu.querySelector<HTMLButtonElement>("#start-btn")?.addEventListener("click", beginMatch);
}

function restartMatch(): void {
  restartState(state);
  startMatch(state);
  syncMenu();
}

function syncMenu(): void {
  menu.hidden = state.mode === "running";
  renderMenuContent();
}

function resizeCanvas(): void {
  const ratio = state.arena.width / state.arena.height;
  const container = frame.getBoundingClientRect();
  let width = container.width;
  let height = width / ratio;
  if (height > container.height) {
    height = container.height;
    width = height * ratio;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function beginMatch(): void {
  if (state.mode === "menu") {
    startMatch(state);
    syncMenu();
  } else if (state.mode === "finished") {
    restartMatch();
  }
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    void frame.requestFullscreen();
  } else {
    void document.exitFullscreen();
  }
}

function keyState(code: string, active: boolean): boolean {
  switch (code) {
    case "ArrowLeft":
    case "KeyA":
      input.left = active;
      return true;
    case "ArrowRight":
    case "KeyD":
      input.right = active;
      return true;
    case "ArrowUp":
    case "KeyW":
      input.forward = active;
      return true;
    case "ArrowDown":
    case "KeyS":
      input.reverse = active;
      return true;
    default:
      return false;
  }
}

function activateAudio(): void {
  void audio.ensureStarted();
}

document.addEventListener("keydown", (event) => {
  activateAudio();
  if (event.repeat) {
    return;
  }
  if (keyState(event.code, true)) {
    event.preventDefault();
  }
  if (event.code === "Enter") {
    beginMatch();
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
  if (event.code === "KeyR" && state.mode === "finished") {
    restartMatch();
  }
});

document.addEventListener("keyup", (event) => {
  if (keyState(event.code, false)) {
    event.preventDefault();
  }
});

document.addEventListener("pointerdown", activateAudio, { passive: true });

window.addEventListener("resize", resizeCanvas);
document.addEventListener("fullscreenchange", resizeCanvas);

function tick(dt: number): void {
  if (state.mode === "running") {
    applyPlayerControls(state, input);
  }
  advanceState(state, dt);
  audio.update(state);
}

function present(): void {
  renderGame(ctx, state);
  syncMenu();
}

let lastTime = performance.now();
let accumulator = 0;
const fixedStep = 1 / 60;
let skipNextFrameCatchup = false;

function frameLoop(now: number): void {
  if (automatedStepping) {
    lastTime = now;
    accumulator = 0;
    present();
    requestAnimationFrame(frameLoop);
    return;
  }
  if (skipNextFrameCatchup) {
    lastTime = now;
    accumulator = 0;
    skipNextFrameCatchup = false;
    present();
    requestAnimationFrame(frameLoop);
    return;
  }
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += delta;
  while (accumulator >= fixedStep) {
    tick(fixedStep);
    accumulator -= fixedStep;
  }
  present();
  requestAnimationFrame(frameLoop);
}

window.advanceTime = (ms: number) => {
  accumulator = 0;
  lastTime = performance.now();
  skipNextFrameCatchup = true;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    tick(fixedStep);
  }
  present();
};

window.render_game_to_text = () => renderGameToText(state);

resizeCanvas();
present();
requestAnimationFrame(frameLoop);

declare global {
  interface Window {
    advanceTime: (ms: number) => void;
    render_game_to_text: () => string;
  }
}
