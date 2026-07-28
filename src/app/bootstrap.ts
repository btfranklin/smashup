import { AudioManager } from "../game/audio";
import { CAR_PRESET_IDS } from "../game/content";
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
import {
  advanceState,
  applyPlayerControls,
  finishSpectatingRound,
} from "../game/runtime";
import type {
  CarPresetId,
  GameState,
  SessionUpgradeId,
} from "../game/types";
import {
  createAppLoop,
  type AppLoop,
  type LoopPerformanceDetails,
} from "./loop";
import {
  createMenuPresenter,
  shouldHideMenu,
  type MenuPresenter,
} from "./menu";
import type {
  PerformanceCollector,
  PerformancePhase,
} from "./performance";

export { shouldHideMenu } from "./menu";
export {
  FIXED_STEP_SECONDS,
  MAX_ADVANCE_TIME_MS,
  SPECTATOR_SKIP_FRAME_BUDGET_MS,
  SPECTATOR_SKIP_MAX_STEPS,
  SPECTATOR_SKIP_MAX_STEPS_PER_BATCH,
} from "./loop";

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

export type AudioDriver = Pick<
  AudioManager,
  "prepare" | "resume" | "update" | "destroy"
> &
  Partial<Pick<AudioManager, "getVoiceCreationCount">>;

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
  cancelAnimationFrame?: (handle: number) => void;
  scheduleIdleTask?: (callback: () => void) => number;
  cancelIdleTask?: (handle: number) => void;
  performanceNow?: () => number;
  performanceCollector?: PerformanceCollector;
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

export function resetInputState(input: InputState): void {
  input.left = false;
  input.right = false;
  input.forward = false;
  input.reverse = false;
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

function reportCleanupError(message: string, error: unknown): void {
  console.error(message, error);
}

export function createAppController({
  appRoot,
  doc = appRoot.ownerDocument,
  win = doc.defaultView as AppWindow,
  nav = win.navigator,
  createAudio = () => new AudioManager(),
  requestAnimationFrame = (callback) => win.requestAnimationFrame(callback),
  cancelAnimationFrame = (handle) => win.cancelAnimationFrame(handle),
  scheduleIdleTask = (callback) => {
    if (typeof win.requestIdleCallback === "function") {
      return win.requestIdleCallback(() => callback(), { timeout: 1500 });
    }
    return win.setTimeout(callback, 250);
  },
  cancelIdleTask = (handle) => {
    if (typeof win.cancelIdleCallback === "function") {
      win.cancelIdleCallback(handle);
    } else {
      win.clearTimeout(handle);
    }
  },
  performanceNow = () => win.performance.now(),
  performanceCollector,
}: BootstrapOptions): AppController {
  let state: GameState;
  let audio: AudioDriver;
  try {
    state = createStateForSearch(win.location.search);
    audio = createAudio();
  } catch (error) {
    try {
      performanceCollector?.destroy();
    } catch (cleanupError) {
      reportCleanupError(
        "Unable to stop performance collection after startup failure.",
        cleanupError,
      );
    }
    throw error;
  }
  const previousHooks = {
    hadAdvanceTime: Object.prototype.hasOwnProperty.call(win, "advanceTime"),
    advanceTime: win.advanceTime,
    hadRenderGameToText: Object.prototype.hasOwnProperty.call(
      win,
      "render_game_to_text",
    ),
    renderGameToText: win.render_game_to_text,
  };
  const teardown: Array<() => void> = [];
  let idleTaskHandle: number | null = null;
  let destroyed = false;
  let destroyPromise: Promise<void> | null = null;
  let appLoop: AppLoop | null = null;
  let menuPresenter: MenuPresenter | null = null;
  let installedAdvanceTimeHook: ((ms: number) => void) | null = null;
  let installedRenderGameToTextHook: (() => string) | null = null;

  function recordPerformance(
    phase: PerformancePhase,
    startedAt: number,
    details: LoopPerformanceDetails = {},
  ): void {
    if (!performanceCollector) {
      return;
    }
    const completedAt = performanceNow();
    performanceCollector.record({
      phase,
      timestampMs: completedAt,
      durationMs: completedAt - startedAt,
      state,
      audioVoicesCreated: audio.getVoiceCreationCount?.() ?? 0,
      ...details,
    });
  }

  function restoreBrowserHooks(): void {
    if (
      installedAdvanceTimeHook &&
      win.advanceTime === installedAdvanceTimeHook
    ) {
      if (previousHooks.hadAdvanceTime) {
        win.advanceTime = previousHooks.advanceTime;
      } else {
        delete win.advanceTime;
      }
    }
    if (
      installedRenderGameToTextHook &&
      win.render_game_to_text === installedRenderGameToTextHook
    ) {
      if (previousHooks.hadRenderGameToText) {
        win.render_game_to_text = previousHooks.renderGameToText;
      } else {
        delete win.render_game_to_text;
      }
    }
  }

  function destroyController(): Promise<void> {
    if (destroyPromise) {
      return destroyPromise;
    }
    destroyPromise = (async () => {
      destroyed = true;
      if (idleTaskHandle !== null) {
        try {
          cancelIdleTask(idleTaskHandle);
        } catch (error) {
          reportCleanupError("Unable to cancel audio preparation.", error);
        }
        idleTaskHandle = null;
      }
      try {
        appLoop?.destroy();
      } catch (error) {
        reportCleanupError("Unable to stop the app loop.", error);
      }
      try {
        menuPresenter?.destroy();
      } catch (error) {
        reportCleanupError("Unable to destroy the menu presenter.", error);
      }
      for (const cleanup of teardown.splice(0).reverse()) {
        try {
          cleanup();
        } catch (error) {
          reportCleanupError("Unable to remove an app listener.", error);
        }
      }
      restoreBrowserHooks();
      try {
        await audio.destroy();
      } catch (error) {
        reportCleanupError("Unable to destroy audio.", error);
      }
      try {
        performanceCollector?.destroy();
      } catch (error) {
        reportCleanupError("Unable to stop performance collection.", error);
      }
    })();
    return destroyPromise;
  }

  try {
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
    let audioActivationPending = false;

    function syncMenu(force = false): void {
      const startedAt = performanceCollector ? performanceNow() : 0;
      menuPresenter?.sync(force);
      recordPerformance("menu", startedAt);
    }

    function syncMenuAndRequestPresentation(force = false): void {
      syncMenu(force);
      appLoop?.requestPresentation();
    }

    function restartFromMenu(): void {
      restartState(state);
      appLoop?.resetClock();
      syncMenu(true);
    }

    function beginCarSelection(): void {
      beginCarSelect(state);
      syncMenuAndRequestPresentation();
    }

    function selectStarterCar(presetId: CarPresetId): void {
      chooseStarterCar(state, presetId);
      appLoop?.resetClock();
      syncMenu();
    }

    function showNextSessionScreen(): void {
      advanceAfterRound(state);
      syncMenuAndRequestPresentation();
    }

    function chooseSessionUpgrade(upgradeId: SessionUpgradeId): void {
      applySessionUpgrade(state, upgradeId);
      syncMenuAndRequestPresentation();
    }

    menuPresenter = createMenuPresenter(menu, state, {
      beginCarSelect: beginCarSelection,
      chooseStarterCar: selectStarterCar,
      advanceAfterRound: showNextSessionScreen,
      applySessionUpgrade: chooseSessionUpgrade,
      skipSpectatingRound: () => {
        appLoop?.startSpectatorSkip();
      },
      restart: restartFromMenu,
    });

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
      appLoop?.requestPresentation();
    }

    function activateAudio(): void {
      if (audioActivationPending || destroyed) {
        return;
      }
      audioActivationPending = true;
      const startedAt = performanceCollector ? performanceNow() : 0;
      void audio
        .resume()
        .then(() => {
          recordPerformance("audio", startedAt);
        })
        .catch((error: unknown) => {
          recordPerformance("audio", startedAt);
          console.error("Unable to start audio.", error);
        })
        .finally(() => {
          audioActivationPending = false;
        });
    }

    function prepareAudio(): void {
      if (destroyed) {
        return;
      }
      const startedAt = performanceCollector ? performanceNow() : 0;
      try {
        audio.prepare();
      } catch (error) {
        console.error("Unable to prepare audio.", error);
      } finally {
        recordPerformance("audio", startedAt);
      }
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
          beginCarSelection();
        } else if (state.mode === "round_results") {
          showNextSessionScreen();
        } else if (state.mode === "spectating") {
          appLoop?.startSpectatorSkip();
        } else if (state.mode === "career_over") {
          restartFromMenu();
        }
      }
      if (event.code === "KeyF") {
        toggleFullscreen();
      }
      const presetShortcut = /^Digit([1-9])$/.exec(event.code);
      const presetId = presetShortcut
        ? CAR_PRESET_IDS[Number(presetShortcut[1]) - 1]
        : null;
      if (presetId && state.mode === "car_select") {
        selectStarterCar(presetId as CarPresetId);
      }
      if (
        event.code === "KeyR" &&
        state.mode !== "running" &&
        state.mode !== "intro" &&
        state.mode !== "spectating"
      ) {
        restartFromMenu();
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

    const releasePlayerInput = () => {
      resetInputState(input);
      const player = state.cars.find((car) => car.id === state.playerId);
      if (player) {
        player.controls.forward = 0;
        player.controls.reverse = 0;
        player.controls.steer = 0;
      }
    };

    const handleWindowBlur = () => {
      releasePlayerInput();
    };

    const handleVisibilityChange = () => {
      if (doc.visibilityState === "hidden") {
        releasePlayerInput();
      }
    };

    doc.addEventListener("keydown", handleKeyDown);
    doc.addEventListener("keyup", handleKeyUp);
    doc.addEventListener("pointerdown", handlePointerDown, { passive: true });
    doc.addEventListener("visibilitychange", handleVisibilityChange);
    win.addEventListener("blur", handleWindowBlur);
    win.addEventListener("resize", resizeCanvas);
    doc.addEventListener("fullscreenchange", resizeCanvas);

    teardown.push(() => doc.removeEventListener("keydown", handleKeyDown));
    teardown.push(() => doc.removeEventListener("keyup", handleKeyUp));
    teardown.push(() =>
      doc.removeEventListener("pointerdown", handlePointerDown),
    );
    teardown.push(() =>
      doc.removeEventListener("visibilitychange", handleVisibilityChange),
    );
    teardown.push(() => win.removeEventListener("blur", handleWindowBlur));
    teardown.push(() => win.removeEventListener("resize", resizeCanvas));
    teardown.push(() =>
      doc.removeEventListener("fullscreenchange", resizeCanvas),
    );

    function tick(dt: number, waitForAudio = true): void {
      const simulationStartedAt = performanceCollector ? performanceNow() : 0;
      if (
        state.mode === "intro" &&
        waitForAudio &&
        audioActivationPending &&
        state.session.countdown <= dt
      ) {
        recordPerformance("simulation", simulationStartedAt);
        return;
      }
      if (state.mode === "running") {
        applyPlayerControls(state, input);
      }
      advanceState(state, dt);
      recordPerformance("simulation", simulationStartedAt, {
        fixedSteps: 1,
      });
      const audioStartedAt = performanceCollector ? performanceNow() : 0;
      audio.update(state);
      recordPerformance("audio", audioStartedAt);
    }

    function renderPresentation(): void {
      const renderStartedAt = performanceCollector ? performanceNow() : 0;
      renderGame(renderContext, state);
      recordPerformance("render", renderStartedAt);
      syncMenu();
    }

    appLoop = createAppLoop({
      automatedStepping,
      requestAnimationFrame,
      cancelAnimationFrame,
      performanceNow,
      performanceEnabled: Boolean(performanceCollector),
      isSpectating: () => state.mode === "spectating",
      runStep: tick,
      runSpectatorStep: (dt) => advanceState(state, dt),
      finishSpectating: () => finishSpectatingRound(state),
      afterSpectatorBatch: () => {
        const audioStartedAt = performanceCollector ? performanceNow() : 0;
        audio.update(state);
        recordPerformance("audio", audioStartedAt);
      },
      present: renderPresentation,
      onSpectatorSkipActive: (active) => {
        menuPresenter?.setSpectatorSkipActive(active);
      },
      recordPerformance,
    });
    const activeLoop = appLoop;

    const renderGameToTextHook = () => renderGameToText(state);
    installedAdvanceTimeHook = activeLoop.advanceTime;
    installedRenderGameToTextHook = renderGameToTextHook;
    installBrowserHooks(win, {
      advanceTime: activeLoop.advanceTime,
      renderGameToText: renderGameToTextHook,
    });

    resizeCanvas();
    syncMenu(true);
    activeLoop.presentNow();
    activeLoop.start();
    idleTaskHandle = scheduleIdleTask(() => {
      idleTaskHandle = null;
      prepareAudio();
    });

    return {
      state,
      frame,
      canvas,
      menu,
      input,
      tick,
      present: activeLoop.presentNow,
      syncMenu,
      resizeCanvas,
      advanceTime: activeLoop.advanceTime,
      destroy: destroyController,
    };
  } catch (error) {
    void destroyController();
    throw error;
  }
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
