import "./style.css";

import {
  CAR_PRESETS,
  ROUND_PLANS,
  SESSION_UPGRADES,
  getModifierSummary,
} from "./game/content";
import { AudioManager } from "./game/audio";
import { renderGameToText } from "./game/debug";
import { parseCarPreviewRequest } from "./game/preview";
import { renderGame } from "./game/render";
import {
  advanceAfterRound,
  applySessionUpgrade,
  beginCarSelect,
  chooseStarterCar,
  createCarPreviewState,
  createInitialState,
  restartState,
} from "./game/session";
import { advanceState, applyPlayerControls } from "./game/runtime";
import {
  getOutlastedDriverLabels,
  getPlayerCar,
  getWinnerCar,
} from "./game/selectors";
import type { CarPresetId, SessionUpgradeId } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root missing.");
}

function renderStartupError(message: string): void {
  const container = document.createElement("section");
  container.className = "startup-error";
  container.dataset.startupError = "true";

  const title = document.createElement("h1");
  title.textContent = "Startup Error";

  const copy = document.createElement("p");
  copy.textContent = message;

  container.append(title, copy);
  app.replaceChildren(container);
}

function bootstrap(): void {
  const previewRequest = parseCarPreviewRequest(window.location.search);
  const state = previewRequest
    ? createCarPreviewState(previewRequest.presetId, previewRequest.scenario)
    : createInitialState();
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

  function resetTournament(): void {
    restartState(state);
    renderMenuContent(true);
  }

  function bindPresetButtons(): void {
    menu
      .querySelectorAll<HTMLButtonElement>("[data-preset-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          chooseStarterCar(state, button.dataset.presetId as CarPresetId);
          syncMenu();
        });
      });
  }

  function bindUpgradeButtons(): void {
    menu
      .querySelectorAll<HTMLButtonElement>("[data-upgrade-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          applySessionUpgrade(
            state,
            button.dataset.upgradeId as SessionUpgradeId,
          );
          syncMenu();
        });
      });
  }

  function renderMenuContent(force = false): void {
    if (state.mode === "car_preview") {
      menu.innerHTML = "";
      return;
    }

    if (!force && menu.dataset.mode === state.mode) {
      return;
    }
    menu.dataset.mode = state.mode;

    if (state.mode === "menu") {
      menu.innerHTML = `
      <h1>Smashup<br />Derby</h1>
      <h2>Three rounds. Pick your ride. Survive the wreckage.</h2>
      <p>Choose a derby car, fight through three themed rounds, and patch the machine between fights.</p>
      <button class="primary-button" id="start-btn" type="button">Start Tournament</button>
      <p class="hint">Press Enter to begin, W/A/S/D or arrows to drive, F for fullscreen.</p>
    `;
      menu
        .querySelector<HTMLButtonElement>("#start-btn")
        ?.addEventListener("click", () => {
          beginCarSelect(state);
          syncMenu();
        });
      return;
    }

    if (state.mode === "car_select") {
      const cards = Object.values(CAR_PRESETS)
        .map(
          (preset, index) => `
          <button class="choice-card" data-preset-id="${preset.id}" ${index === 0 ? 'id="recommended-preset"' : ""} type="button">
            <span class="choice-kicker">${preset.subtitle}</span>
            <strong>${preset.title}</strong>
            <span>${preset.description}</span>
            <span>Mass ${preset.mass} | Reverse ${preset.reverseMaxSpeed} | Top ${preset.forwardMaxSpeed}</span>
          </button>
        `,
        )
        .join("");
      menu.innerHTML = `
      <h1>Choose<br />Your Ride</h1>
      <h2>Pick a derby identity for the full three-round run.</h2>
      <div class="choice-grid">${cards}</div>
      <p class="hint">Heavier cars take punishment. Faster cars escape better. Backstab hits hardest in reverse.</p>
    `;
      bindPresetButtons();
      return;
    }

    if (state.mode === "round_results") {
      const summary = state.session.lastRoundSummary;
      menu.innerHTML = `
      <h1>Round ${summary?.roundIndex ?? state.session.roundIndex + 1}<br />Result</h1>
      <h2>${summary?.playerWon ? "You survived this heat." : "Your run hit the wall."}</h2>
      <p>${summary?.playerWon ? `Winner: ${summary.winnerLabel ?? "Player"}.` : `Knocked out by: ${summary?.eliminatedByLabel ?? "the field"}.`}</p>
      <p>${summary?.knockoutReason ? `Cause: ${summary.knockoutReason}.` : `Biggest hit: ${summary?.biggestHitLabel ?? "None"} (${Math.round((summary?.biggestHitSeverity ?? 0) * 100)}%).`}</p>
      <p>${summary?.playerKnockouts.length ? `You wrecked: ${summary.playerKnockouts.join(", ")}.` : "No knockouts credited to you this round."}</p>
      <button class="primary-button" id="advance-btn" type="button">${summary?.playerWon && state.session.roundIndex < state.session.totalRounds - 1 ? "Pit Stop" : "Tournament Wrap-Up"}</button>
      <p class="hint">Survival time: ${summary?.survivalTime ?? 0}s.</p>
    `;
      menu
        .querySelector<HTMLButtonElement>("#advance-btn")
        ?.addEventListener("click", () => {
          advanceAfterRound(state);
          syncMenu();
        });
      return;
    }

    if (state.mode === "upgrade") {
      const nextPlan = ROUND_PLANS[state.session.roundIndex + 1];
      const cards = Object.values(SESSION_UPGRADES)
        .map(
          (upgrade, index) => `
          <button class="choice-card" data-upgrade-id="${upgrade.id}" ${index === 0 ? 'id="recommended-upgrade"' : ""} type="button">
            <span class="choice-kicker">Pit Choice</span>
            <strong>${upgrade.title}</strong>
            <span>${upgrade.description}</span>
          </button>
        `,
        )
        .join("");
      menu.innerHTML = `
      <h1>Pit<br />Choice</h1>
      <h2>Next up: ${nextPlan?.title ?? "Final Heat"}</h2>
      <p>Round ${state.session.roundIndex + 2} of ${state.session.totalRounds}. ${nextPlan ? getModifierSummary(nextPlan.modifier) : ""}.</p>
      <div class="choice-grid">${cards}</div>
      <p class="hint">One choice only. Damage carries forward, but the pit crew gives a small baseline repair either way.</p>
    `;
      bindUpgradeButtons();
      return;
    }

    if (state.mode === "tournament_over") {
      const winner = getWinnerCar(state);
      const playerLost = getPlayerCar(state)?.disabled ?? false;
      const rounds = state.session.completedRounds
        .map(
          (round) =>
            `<li>Round ${round.roundIndex}: ${round.title} - ${round.playerWon ? "Win" : `Out by ${round.eliminatedByLabel ?? "the field"}`}</li>`,
        )
        .join("");
      menu.innerHTML = `
      <h1>Tournament<br />Over</h1>
      <h2>${
        playerLost
          ? "The derby chewed you up."
          : winner?.isPlayer
            ? "You outlasted the whole card."
            : `${winner?.label ?? "Nobody"} took the crown.`
      }</h2>
      <p>${
        playerLost
          ? `Drivers still rolling when you went out: ${getOutlastedDriverLabels(state).join(", ") || "nobody"}.`
          : `Rounds cleared: ${state.session.completedRounds.length}/${state.session.totalRounds}.`
      }</p>
      <ul class="results-list">${rounds}</ul>
      <button class="primary-button" id="start-btn" type="button">Restart Tournament</button>
      <p class="hint">Press R or click restart.</p>
    `;
      menu
        .querySelector<HTMLButtonElement>("#start-btn")
        ?.addEventListener("click", resetTournament);
    }
  }

  function syncMenu(): void {
    menu.hidden =
      state.mode === "running" ||
      state.mode === "intro" ||
      state.mode === "car_preview";
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

  function activateAudio(): void {
    void audio.ensureStarted();
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

  document.addEventListener("keydown", (event) => {
    activateAudio();
    if (event.repeat) {
      return;
    }
    if (keyState(event.code, true)) {
      event.preventDefault();
    }
    if (event.code === "Enter") {
      if (state.mode === "menu") {
        beginCarSelect(state);
        syncMenu();
      } else if (state.mode === "round_results") {
        advanceAfterRound(state);
        syncMenu();
      } else if (state.mode === "tournament_over") {
        resetTournament();
        syncMenu();
      }
    }
    if (event.code === "KeyF") {
      toggleFullscreen();
    }
    if (event.code === "Digit1" && state.mode === "car_select") {
      chooseStarterCar(state, "bulldozer");
      syncMenu();
    }
    if (event.code === "Digit2" && state.mode === "car_select") {
      chooseStarterCar(state, "darter");
      syncMenu();
    }
    if (event.code === "Digit3" && state.mode === "car_select") {
      chooseStarterCar(state, "backstab");
      syncMenu();
    }
    if (
      event.code === "KeyR" &&
      state.mode !== "running" &&
      state.mode !== "intro"
    ) {
      resetTournament();
      syncMenu();
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
  renderMenuContent(true);
  present();
  requestAnimationFrame(frameLoop);
}

try {
  bootstrap();
} catch (error) {
  console.error(error);
  renderStartupError(
    error instanceof Error ? error.message : "Smashup Derby failed to start.",
  );
}

declare global {
  interface Window {
    advanceTime: (ms: number) => void;
    render_game_to_text: () => string;
  }
}
