import {
  CAR_PRESET_IDS,
  CAR_PRESETS,
  ROUND_PLANS,
  SESSION_UPGRADES,
  getModifierSummary,
} from "../game/content";
import { AudioManager } from "../game/audio";
import { renderGameToText } from "../game/debug";
import { parseCarPreviewRequest } from "../game/preview";
import { renderGame } from "../game/render";
import {
  advanceAfterRound,
  applySessionUpgrade,
  beginCarSelect,
  chooseStarterCar,
  createCarPreviewState,
  createInitialState,
  restartState,
} from "../game/session";
import { advanceState, applyPlayerControls } from "../game/runtime";
import {
  getOutlastedDriverLabels,
  getPlayerCar,
  getWinnerCar,
} from "../game/selectors";
import type { CarPresetId, GameState, Mode, SessionUpgradeId } from "../game/types";

type AppWindow = Window &
  typeof globalThis & {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  };

export type InputState = {
  left: boolean;
  right: boolean;
  forward: boolean;
  reverse: boolean;
};

export type AudioDriver = Pick<AudioManager, "ensureStarted" | "update" | "destroy">;

export type AppController = {
  state: GameState;
  frame: HTMLDivElement;
  canvas: HTMLCanvasElement;
  menu: HTMLElement;
  input: InputState;
  tick: (dt: number) => void;
  present: () => void;
  syncMenu: () => void;
  resizeCanvas: () => void;
  advanceTime: (ms: number) => void;
  destroy: () => Promise<void>;
};

export type BootstrapOptions = {
  appRoot: HTMLDivElement;
  doc?: Document;
  win?: AppWindow;
  nav?: Navigator;
  createAudio?: () => AudioDriver;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  performanceNow?: () => number;
};

export function renderStartupError(
  appRoot: HTMLElement,
  message: string,
  doc = appRoot.ownerDocument,
): void {
  const container = doc.createElement("section");
  container.className = "startup-error";
  container.dataset.startupError = "true";

  const title = doc.createElement("h1");
  title.textContent = "Startup Error";

  const copy = doc.createElement("p");
  copy.textContent = message;

  container.append(title, copy);
  appRoot.replaceChildren(container);
}

export function createStateForSearch(search: string): GameState {
  const previewRequest = parseCarPreviewRequest(search);
  return previewRequest
    ? createCarPreviewState(previewRequest.presetId, previewRequest.scenario)
    : createInitialState();
}

export function setInputKeyState(
  input: InputState,
  code: string,
  active: boolean,
): boolean {
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

export function computeCanvasDisplaySize(
  arenaWidth: number,
  arenaHeight: number,
  containerWidth: number,
  containerHeight: number,
): { width: number; height: number } {
  const ratio = arenaWidth / arenaHeight;
  let width = containerWidth;
  let height = width / ratio;
  if (height > containerHeight) {
    height = containerHeight;
    width = height * ratio;
  }
  return { width, height };
}

export function shouldHideMenu(mode: Mode): boolean {
  return mode === "running" || mode === "intro" || mode === "car_preview";
}

export function installBrowserHooks(
  win: AppWindow,
  hooks: {
    advanceTime: (ms: number) => void;
    renderGameToText: () => string;
  },
): void {
  win.advanceTime = hooks.advanceTime;
  win.render_game_to_text = hooks.renderGameToText;
}

export function createAppController({
  appRoot,
  doc = appRoot.ownerDocument,
  win = doc.defaultView as AppWindow,
  nav = win.navigator,
  createAudio = () => new AudioManager(),
  requestAnimationFrame = (callback) => win.requestAnimationFrame(callback),
  performanceNow = () => win.performance.now(),
}: BootstrapOptions): AppController {
  const state = createStateForSearch(win.location.search);
  const orderedCarPresets = CAR_PRESET_IDS.map((id) => CAR_PRESETS[id]);
  const audio = createAudio();
  const frame = doc.createElement("div");
  frame.className = "frame";

  const canvas = doc.createElement("canvas");
  canvas.width = state.arena.width;
  canvas.height = state.arena.height;
  canvas.setAttribute("aria-label", "Smashup Derby arena");

  const menu = doc.createElement("section");
  menu.className = "menu";

  frame.append(canvas, menu);
  appRoot.replaceChildren(frame);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable.");
  }
  const renderContext: CanvasRenderingContext2D = ctx;

  const input: InputState = {
    left: false,
    right: false,
    forward: false,
    reverse: false,
  };
  const automatedStepping = Boolean(nav.webdriver);
  const teardown: Array<() => void> = [];
  let destroyed = false;

  function renderMainMenu(): void {
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
  }

  function renderCarSelectMenu(): void {
    const cards = orderedCarPresets
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
    menu
      .querySelectorAll<HTMLButtonElement>("[data-preset-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          chooseStarterCar(state, button.dataset.presetId as CarPresetId);
          syncMenu();
        });
      });
  }

  function renderRoundResultsMenu(): void {
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
  }

  function renderUpgradeMenu(): void {
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

  function renderTournamentOverMenu(): void {
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
      ?.addEventListener("click", () => {
        restartState(state);
        renderMenuContent(true);
      });
  }

  function renderMenuContent(force = false): void {
    if (state.mode === "car_preview") {
      menu.dataset.mode = state.mode;
      menu.innerHTML = "";
      return;
    }

    if (!force && menu.dataset.mode === state.mode) {
      return;
    }
    menu.dataset.mode = state.mode;

    if (state.mode === "menu") {
      renderMainMenu();
    } else if (state.mode === "car_select") {
      renderCarSelectMenu();
    } else if (state.mode === "round_results") {
      renderRoundResultsMenu();
    } else if (state.mode === "upgrade") {
      renderUpgradeMenu();
    } else if (state.mode === "tournament_over") {
      renderTournamentOverMenu();
    }
  }

  function syncMenu(): void {
    menu.hidden = shouldHideMenu(state.mode);
    renderMenuContent();
  }

  function resizeCanvas(): void {
    const container = frame.getBoundingClientRect();
    const size = computeCanvasDisplaySize(
      state.arena.width,
      state.arena.height,
      container.width,
      container.height,
    );
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
  }

  function activateAudio(): void {
    void audio.ensureStarted().catch((error: unknown) => {
      console.error("Unable to start audio.", error);
    });
  }

  function toggleFullscreen(): void {
    if (!doc.fullscreenElement) {
      void frame.requestFullscreen?.();
    } else {
      void doc.exitFullscreen?.();
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    activateAudio();
    if (event.repeat) {
      return;
    }
    if (setInputKeyState(input, event.code, true)) {
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
        restartState(state);
        renderMenuContent(true);
      }
    }
    if (event.code === "KeyF") {
      toggleFullscreen();
    }
    const presetShortcut = /^Digit([1-9])$/.exec(event.code);
    const preset = presetShortcut
      ? orderedCarPresets[Number(presetShortcut[1]) - 1]
      : null;
    if (preset && state.mode === "car_select") {
      chooseStarterCar(state, preset.id);
      syncMenu();
    }
    if (
      event.code === "KeyR" &&
      state.mode !== "running" &&
      state.mode !== "intro"
    ) {
      restartState(state);
      renderMenuContent(true);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (setInputKeyState(input, event.code, false)) {
      event.preventDefault();
    }
  };

  const handlePointerDown = () => {
    activateAudio();
  };

  doc.addEventListener("keydown", handleKeyDown);
  doc.addEventListener("keyup", handleKeyUp);
  doc.addEventListener("pointerdown", handlePointerDown, { passive: true });
  win.addEventListener("resize", resizeCanvas);
  doc.addEventListener("fullscreenchange", resizeCanvas);

  teardown.push(() => doc.removeEventListener("keydown", handleKeyDown));
  teardown.push(() => doc.removeEventListener("keyup", handleKeyUp));
  teardown.push(() => doc.removeEventListener("pointerdown", handlePointerDown));
  teardown.push(() => win.removeEventListener("resize", resizeCanvas));
  teardown.push(() => doc.removeEventListener("fullscreenchange", resizeCanvas));

  function tick(dt: number): void {
    if (state.mode === "running") {
      applyPlayerControls(state, input);
    }
    advanceState(state, dt);
    audio.update(state);
  }

  function present(): void {
    renderGame(renderContext, state);
    syncMenu();
  }

  let lastTime = performanceNow();
  let accumulator = 0;
  const fixedStep = 1 / 60;
  let skipNextFrameCatchup = false;

  function advanceTime(ms: number): void {
    if (destroyed) {
      return;
    }
    accumulator = 0;
    lastTime = performanceNow();
    skipNextFrameCatchup = true;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      tick(fixedStep);
    }
    present();
  }

  function scheduleNextFrame(): void {
    if (!destroyed) {
      requestAnimationFrame(frameLoop);
    }
  }

  function frameLoop(now: number): void {
    if (destroyed) {
      return;
    }
    if (automatedStepping) {
      lastTime = now;
      accumulator = 0;
      present();
      scheduleNextFrame();
      return;
    }
    if (skipNextFrameCatchup) {
      lastTime = now;
      accumulator = 0;
      skipNextFrameCatchup = false;
      present();
      scheduleNextFrame();
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
    scheduleNextFrame();
  }

  const renderGameToTextHook = () => renderGameToText(state);
  installBrowserHooks(win, {
    advanceTime,
    renderGameToText: renderGameToTextHook,
  });

  resizeCanvas();
  renderMenuContent(true);
  present();
  scheduleNextFrame();

  return {
    state,
    frame,
    canvas,
    menu,
    input,
    tick,
    present,
    syncMenu,
    resizeCanvas,
    advanceTime,
    destroy: async () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      teardown.forEach((cleanup) => cleanup());
      if (win.advanceTime === advanceTime) {
        delete win.advanceTime;
      }
      if (win.render_game_to_text === renderGameToTextHook) {
        delete win.render_game_to_text;
      }
      await audio.destroy();
    },
  };
}

export function bootstrapApp(options: BootstrapOptions): AppController | null {
  try {
    return createAppController(options);
  } catch (error) {
    console.error(error);
    renderStartupError(
      options.appRoot,
      error instanceof Error ? error.message : "Smashup Derby failed to start.",
      options.doc ?? options.appRoot.ownerDocument,
    );
    return null;
  }
}
