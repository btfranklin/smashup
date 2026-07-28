// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapApp,
  computeCanvasDisplaySize,
  createAppController,
  createStateForSearch,
  installBrowserHooks,
  MAX_ADVANCE_TIME_MS,
  renderStartupError,
  resetInputState,
  setInputKeyState,
  shouldHideMenu,
  SPECTATOR_SKIP_MAX_STEPS,
} from "../src/app/bootstrap";
import { PLACEMENT_POINTS } from "../src/game/career";
import { chooseStarterCar } from "../src/game/session";
import { createDomHarness } from "./helpers/dom-harness";
import { createRoundSummaryFixture } from "./helpers/fixtures";
import { parsePayload } from "./helpers/payload-assertions";

describe("jsdom bootstrap and app-controller contract", () => {
  let harness: ReturnType<typeof createDomHarness>;
  let controllers: Array<ReturnType<typeof createAppController>>;

  beforeEach(() => {
    delete window.advanceTime;
    delete window.render_game_to_text;
    window.history.replaceState({}, "", "/");
    harness = createDomHarness();
    controllers = [];
  });

  afterEach(async () => {
    await Promise.all(controllers.map((controller) => controller.destroy()));
    harness.cleanup();
  });

  function createTestController(
    options: Partial<Parameters<typeof createAppController>[0]> = {},
  ) {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      cancelAnimationFrame: harness.cancelAnimationFrame,
      scheduleIdleTask: harness.scheduleIdleTask,
      cancelIdleTask: harness.cancelIdleTask,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        prepare: vi.fn(),
        resume: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
      ...options,
    });
    controllers.push(controller);
    return controller;
  }

  it("renders a visible startup error for invalid preview params and does not install hooks", () => {
    const destroyCollector = vi.fn();
    window.history.replaceState(
      {},
      "",
      "/?preview=car&preset=bad-car&scenario=pristine",
    );

    const controller = bootstrapApp({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      performanceCollector: {
        record: vi.fn(),
        snapshot: () => ({
          capacity: 1,
          droppedSamples: 0,
          samples: [],
          longTasks: [],
          garbageCollections: [],
        }),
        destroy: destroyCollector,
      },
    });

    expect(controller).toBeNull();
    expect(harness.appRoot.textContent).toContain("Startup Error");
    expect(harness.appRoot.textContent).toContain("Invalid car preview preset");
    expect(window.render_game_to_text).toBeUndefined();
    expect(destroyCollector).toHaveBeenCalledTimes(1);
  });

  it("boots the normal app shell with frame, canvas, and menu", () => {
    const controller = createTestController();

    expect(harness.appRoot.contains(controller.frame)).toBe(true);
    expect(controller.canvas.getAttribute("aria-label")).toContain("arena");
    expect(controller.menu.textContent).toContain("Start Career Night");
    expect(controller.menu.textContent).toContain("5 rounds");
    expect(window.advanceTime).toBeTypeOf("function");
    expect(window.render_game_to_text).toBeTypeOf("function");
  });

  it("boots preview mode with hidden menu content", () => {
    window.history.replaceState(
      {},
      "",
      "/?preview=car&preset=bulldozer&scenario=critical",
    );

    const controller = createTestController();

    expect(controller.state.mode).toBe("car_preview");
    expect(controller.menu.hidden).toBe(true);
    expect(controller.menu.textContent?.trim()).toBe("");
    expect(controller.menu.querySelector("button")).toBeNull();
  });

  it("advances from menu to car select and then into the round intro", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    expect(controller.state.mode).toBe("car_select");
    expect(controller.menu.textContent).toContain("5-round run");

    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.playerBuild?.presetId).toBe("bulldozer");
  });

  it("uses content-ordered preset number shortcuts while in car select", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit9" }));
    expect(controller.state.mode).toBe("car_select");

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2" }));
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.playerBuild?.presetId).toBe("darter");
  });

  it("keeps advanceTime deterministic and installs render_game_to_text", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    const advanceTime = window.advanceTime;
    const renderGameToText = window.render_game_to_text;
    if (!advanceTime || !renderGameToText) {
      throw new Error("Browser hooks missing from test controller.");
    }

    advanceTime(3500);

    const payload = parsePayload(renderGameToText());
    expect(controller.state.mode).toBe("running");
    expect(payload.mode).toBe("running");
    expect((payload.session as { selectedPreset: string }).selectedPreset).toBe(
      "bulldozer",
    );
  });

  it("defines exact bounded and partition-independent advanceTime semantics", async () => {
    const run = async (durations: number[]) => {
      const controller = createTestController();
      chooseStarterCar(controller.state, "bulldozer", 42);
      controller.state.mode = "running";
      controller.state.session.countdown = 0;
      const beforeZero = JSON.stringify(controller.state);
      controller.advanceTime(0);
      expect(JSON.stringify(controller.state)).toBe(beforeZero);
      for (const duration of durations) {
        controller.advanceTime(duration);
      }
      const snapshot = JSON.stringify(controller.state);
      await controller.destroy();
      return snapshot;
    };

    const whole = await run([1000]);
    const partitioned = await run([
      7.5, 12.5, 80, 100, 200, 300, 125, 175,
    ]);
    expect(partitioned).toBe(whole);

    const controller = createTestController();
    for (const invalid of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      MAX_ADVANCE_TIME_MS + 0.001,
    ]) {
      expect(() => controller.advanceTime(invalid)).toThrow(RangeError);
    }
  });

  it("applies canvas display size from the supplied rectangle", () => {
    const controller = createTestController();

    harness.setContainerSize(600, 400);
    controller.resizeCanvas();
    expect(controller.canvas.style.width).toBe("600px");
    expect(controller.canvas.style.height).toBe("360px");
  });

  it("routes fullscreen calls from supplied stub state", () => {
    const controller = createTestController();
    harness.attachFullscreenStub(controller.frame);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    const requestFullscreen = controller.frame
      .requestFullscreen as unknown as ReturnType<typeof vi.fn>;
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    expect(harness.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("tracks keyboard input state through keydown and keyup", () => {
    const controller = createTestController();

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
    expect(controller.input).toEqual({
      left: true,
      right: false,
      forward: true,
      reverse: false,
    });

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyA" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp" }));
    expect(controller.input).toEqual({
      left: false,
      right: false,
      forward: false,
      reverse: false,
    });
  });

  it("releases input and live controls on blur or hidden visibility", async () => {
    const controller = createTestController();
    chooseStarterCar(controller.state, "bulldozer", 42);
    controller.state.mode = "running";

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    controller.tick(1 / 60);
    expect(controller.input.forward).toBe(true);
    expect(controller.state.cars[0].controls.forward).toBe(1);

    window.dispatchEvent(new Event("blur"));
    expect(controller.input.forward).toBe(false);
    expect(controller.state.cars[0].controls.forward).toBe(0);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    controller.tick(1 / 60);
    expect(controller.state.cars[0].controls.steer).toBe(-1);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(controller.input.left).toBe(false);
    expect(controller.state.cars[0].controls.steer).toBe(0);

    await controller.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    window.dispatchEvent(new Event("blur"));
    expect(controller.input.forward).toBe(false);
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("prepares audio while idle and only resumes it from user activation", () => {
    const prepare = vi.fn();
    const resume = vi.fn().mockResolvedValue(undefined);
    createTestController({
      createAudio: () => ({
        prepare,
        resume,
        update: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(harness.pendingIdleTasks()).toBe(1);
    harness.flushIdleTasks();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("pointerdown"));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("holds the green flag until gesture-time audio activation settles", async () => {
    const deferred: { resolve: () => void } = { resolve: () => undefined };
    const resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          deferred.resolve = resolve;
        }),
    );
    const controller = createTestController({
      createAudio: () => ({
        prepare: vi.fn(),
        resume,
        update: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });
    chooseStarterCar(controller.state, "bulldozer", 42);
    controller.state.session.countdown = 1 / 60;

    document.dispatchEvent(new Event("pointerdown"));
    controller.tick(1 / 60);
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.countdown).toBe(1 / 60);

    deferred.resolve();
    await vi.waitFor(() => expect(resume).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.tick(1 / 60);
    expect(controller.state.mode).toBe("running");
  });

  it("feeds every controller phase into an injected bounded collector", async () => {
    const record = vi.fn();
    const destroyCollector = vi.fn();
    const controller = createTestController({
      performanceCollector: {
        record,
        snapshot: () => ({
          capacity: 10,
          droppedSamples: 0,
          samples: [],
          longTasks: [],
          garbageCollections: [],
        }),
        destroy: destroyCollector,
      },
      createAudio: () => ({
        prepare: vi.fn(),
        resume: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
        getVoiceCreationCount: () => 7,
      }),
    });
    chooseStarterCar(controller.state, "bulldozer", 42);
    controller.state.mode = "running";
    controller.tick(1 / 60);
    controller.present();
    harness.advanceClock(16);
    harness.flushAnimationFrames(16);

    controller.state.mode = "spectating";
    controller.state.cars[0].disabled = true;
    controller.state.cars[0].eliminationTime = controller.state.elapsed;
    controller.state.cars.slice(2).forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = controller.state.elapsed - index - 1;
    });
    controller.syncMenu();
    controller.menu.querySelector<HTMLButtonElement>("#skip-btn")?.click();
    harness.flushAnimationFrames(32);

    const phases = record.mock.calls.map(
      (call) => (call[0] as { phase: string }).phase,
    );
    expect(phases).toEqual(
      expect.arrayContaining([
        "simulation",
        "audio",
        "render",
        "menu",
        "frame",
        "skip",
      ]),
    );
    expect(
      record.mock.calls.some(
        (call) =>
          (call[0] as { audioVoicesCreated: number }).audioVoicesCreated === 7,
      ),
    ).toBe(true);

    await controller.destroy();
    expect(destroyCollector).toHaveBeenCalledTimes(1);
  });

  it("uses and cancels the browser scheduling adapters by default", async () => {
    const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
      window,
      "requestAnimationFrame",
    );
    const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(
      window,
      "cancelAnimationFrame",
    );
    const originalRequestIdleCallback = Object.getOwnPropertyDescriptor(
      window,
      "requestIdleCallback",
    );
    const originalCancelIdleCallback = Object.getOwnPropertyDescriptor(
      window,
      "cancelIdleCallback",
    );
    const requestAnimationFrame = vi.fn(() => 71);
    const cancelAnimationFrame = vi.fn();
    const requestIdleCallback = vi.fn(() => 81);
    const cancelIdleCallback = vi.fn();

    Object.defineProperties(window, {
      requestAnimationFrame: {
        configurable: true,
        value: requestAnimationFrame,
      },
      cancelAnimationFrame: {
        configurable: true,
        value: cancelAnimationFrame,
      },
      requestIdleCallback: {
        configurable: true,
        value: requestIdleCallback,
      },
      cancelIdleCallback: {
        configurable: true,
        value: cancelIdleCallback,
      },
    });

    try {
      const controller = createAppController({
        appRoot: harness.appRoot,
        createAudio: () => ({
          prepare: vi.fn(),
          resume: vi.fn().mockResolvedValue(undefined),
          update: vi.fn(),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      });
      controllers.push(controller);

      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(requestIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 1500 },
      );

      await controller.destroy();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(71);
      expect(cancelIdleCallback).toHaveBeenCalledWith(81);
    } finally {
      for (const [name, descriptor] of [
        ["requestAnimationFrame", originalRequestAnimationFrame],
        ["cancelAnimationFrame", originalCancelAnimationFrame],
        ["requestIdleCallback", originalRequestIdleCallback],
        ["cancelIdleCallback", originalCancelIdleCallback],
      ] as const) {
        if (descriptor) {
          Object.defineProperty(window, name, descriptor);
        } else {
          Reflect.deleteProperty(window, name);
        }
      }
    }
  });

  it("reports rejected audio activation without an unhandled promise", async () => {
    const activationError = new Error("Audio activation failed.");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createTestController({
      createAudio: () => ({
        prepare: vi.fn(),
        resume: vi.fn().mockRejectedValue(activationError),
        update: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });

    document.dispatchEvent(new Event("pointerdown"));

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Unable to start audio.", activationError);
    });
    consoleError.mockRestore();
  });

  it("keeps the small bootstrap helpers table-testable", () => {
    const input = {
      left: false,
      right: false,
      forward: false,
      reverse: false,
    };
    expect(setInputKeyState(input, "KeyD", true)).toBe(true);
    expect(setInputKeyState(input, "Space", true)).toBe(false);
    expect(input.right).toBe(true);
    resetInputState(input);
    expect(input).toEqual({
      left: false,
      right: false,
      forward: false,
      reverse: false,
    });

    expect(computeCanvasDisplaySize(1500, 900, 600, 400)).toEqual({
      width: 600,
      height: 360,
    });
    expect(shouldHideMenu("running")).toBe(true);
    expect(shouldHideMenu("menu")).toBe(false);

    installBrowserHooks(window, {
      advanceTime: vi.fn(),
      renderGameToText: () => "{}",
    });
    const renderGameToText = window.render_game_to_text;
    if (!renderGameToText) {
      throw new Error("Render text hook missing after hook installation.");
    }
    expect(renderGameToText()).toBe("{}");

    renderStartupError(harness.appRoot, "Broken");
    expect(harness.appRoot.textContent).toContain("Broken");
    expect(createStateForSearch("?preview=car&preset=bulldozer&scenario=pristine").mode).toBe(
      "car_preview",
    );
  });

  it("renders round-results and upgrade flows through the menu", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    controller.state.mode = "round_results";
    controller.state.session.lastRoundSummary = createRoundSummaryFixture({
      playerKnockouts: ["Rimshot"],
      biggestHitLabel: "Player into Rimshot",
      biggestHitSeverity: 0.9,
      awardIds: ["sledgehammer", "finisher"],
    });
    controller.syncMenu();
    expect(controller.menu.textContent).toContain("Round 1");
    expect(controller.menu.textContent).toContain("Sledgehammer");
    expect(controller.menu.textContent).toContain("+10");
    harness.appRoot.querySelector<HTMLButtonElement>("#advance-btn")?.click();
    expect(controller.state.mode).toBe("upgrade");

    controller.syncMenu();
    expect(controller.menu.textContent).toContain("Pit Choice");
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-upgrade-id="ram_rig"]')
      ?.click();
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.roundIndex).toBe(1);
  });

  it("renders champion standings and supports keyboard restart", () => {
    const controller = createTestController();
    chooseStarterCar(controller.state, "bulldozer", 42);
    const placements = controller.state.cars.map((car, index) => ({
      driverId: car.id,
      label: car.label,
      presetId: car.presetId,
      isPlayer: car.isPlayer,
      place: index + 1,
      points: PLACEMENT_POINTS[index],
    }));
    controller.state.mode = "career_over";
    controller.state.session.completedRounds = Array.from(
      { length: 5 },
      (_, index) =>
        createRoundSummaryFixture({
          roundNumber: index + 1,
          title: `Round ${index + 1}`,
          placements,
          awardIds: index === 0 ? ["last_car_rolling"] : [],
        }),
    );
    controller.syncMenu();

    expect(
      controller.menu.querySelector(".career-finale.player-champion"),
    ).not.toBeNull();
    expect(controller.menu.querySelectorAll(".standings-table tbody tr")).toHaveLength(
      8,
    );
    expect(controller.menu.querySelector(".champion-sparks")).not.toBeNull();
    expect(controller.menu.textContent).toContain("Last Car Rolling");
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
    expect(controller.state.mode).toBe("menu");
  });

  it("renders a restrained field-champion finale", () => {
    const controller = createTestController();
    chooseStarterCar(controller.state, "bulldozer", 42);
    const orderedCars = [
      controller.state.cars[1],
      controller.state.cars[0],
      ...controller.state.cars.slice(2),
    ];
    const placements = orderedCars.map((car, index) => ({
      driverId: car.id,
      label: car.label,
      presetId: car.presetId,
      isPlayer: car.isPlayer,
      place: index + 1,
      points: PLACEMENT_POINTS[index],
    }));
    controller.state.mode = "career_over";
    controller.state.session.completedRounds = Array.from(
      { length: 5 },
      (_, index) =>
        createRoundSummaryFixture({
          roundNumber: index + 1,
          playerWon: false,
          winnerLabel: orderedCars[0].label,
          placements,
        }),
    );

    controller.syncMenu();

    expect(controller.menu.textContent).toContain("Rimshot");
    expect(controller.menu.textContent).toContain("You finished 2nd");
    expect(controller.menu.querySelector(".champion-sparks")).toBeNull();
  });

  it("shows spectating controls and skips through the live simulation", () => {
    const controller = createTestController();
    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    controller.state.mode = "spectating";
    controller.state.cars[0].disabled = true;
    controller.state.cars[0].eliminationTime = controller.state.elapsed;
    controller.state.cars.slice(2).forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = controller.state.elapsed - index - 1;
    });
    controller.syncMenu();

    const skip = controller.menu.querySelector<HTMLButtonElement>("#skip-btn");
    expect(skip?.textContent).toContain("Skip to Results");
    skip?.click();
    expect(
      controller.menu.querySelector<HTMLButtonElement>("#skip-btn")?.disabled,
    ).toBe(true);

    harness.flushAnimationFrames();

    expect(controller.state.mode).toBe("round_results");
    expect(controller.state.session.lastRoundSummary?.placements).toHaveLength(8);
    const completedElapsed = controller.state.elapsed;
    harness.advanceClock(1_000);
    harness.flushAnimationFrames(1_000);
    expect(controller.state.elapsed).toBe(completedElapsed);
  });

  it("condition-ranks a still-live field after exactly 5,400 skip steps", () => {
    const record = vi.fn();
    const controller = createTestController({
      performanceCollector: {
        record,
        snapshot: () => ({
          capacity: 1_000,
          droppedSamples: 0,
          samples: [],
          longTasks: [],
          garbageCollections: [],
        }),
        destroy: vi.fn(),
      },
    });
    chooseStarterCar(controller.state, "bulldozer", 42);
    controller.state.mode = "spectating";
    const player = controller.state.cars[0];
    player.disabled = true;
    player.eliminationTime = controller.state.elapsed;
    for (const car of controller.state.cars.slice(1)) {
      car.disabled = false;
      car.eliminationTime = null;
      car.bodyArmor = 1_000_000_000;
      car.frontArmor = 1_000_000_000;
      car.systems = {
        engine: 1,
        radiator: 100,
        transmission: 1,
        steering: 1,
        overheat: 0,
      };
    }
    controller.syncMenu();
    const startedElapsed = controller.state.elapsed;

    controller.menu.querySelector<HTMLButtonElement>("#skip-btn")?.click();
    for (
      let callback = 0;
      callback < 100 && controller.state.mode === "spectating";
      callback += 1
    ) {
      harness.flushAnimationFrames();
    }

    const skipSamples = record.mock.calls
      .map((call) => call[0] as { phase: string; fixedSteps?: number })
      .filter((sample) => sample.phase === "skip");
    expect(controller.state.mode).toBe("round_results");
    expect(controller.state.elapsed - startedElapsed).toBeCloseTo(90, 8);
    expect(
      skipSamples.reduce(
        (total, sample) => total + (sample.fixedSteps ?? 0),
        0,
      ),
    ).toBe(SPECTATOR_SKIP_MAX_STEPS);
    expect(
      skipSamples.every((sample) => (sample.fixedSteps ?? 0) <= 60),
    ).toBe(true);
  });

  it("rolls back audio and preserves existing hooks on early startup failure", async () => {
    const previousAdvanceTime = vi.fn();
    const previousRenderText = vi.fn(() => '{"sentinel":true}');
    window.advanceTime = previousAdvanceTime;
    window.render_game_to_text = previousRenderText;
    const destroy = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });

    const failed = bootstrapApp({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      cancelAnimationFrame: harness.cancelAnimationFrame,
      scheduleIdleTask: harness.scheduleIdleTask,
      cancelIdleTask: harness.cancelIdleTask,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        prepare: vi.fn(),
        resume,
        update: vi.fn(),
        destroy,
      }),
    });

    expect(failed).toBeNull();
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
    expect(window.advanceTime).toBe(previousAdvanceTime);
    expect(window.render_game_to_text).toBe(previousRenderText);
    expect(harness.pendingAnimationFrames()).toBe(0);
    expect(harness.pendingIdleTasks()).toBe(0);
    document.dispatchEvent(new Event("pointerdown"));
    expect(resume).not.toHaveBeenCalled();
  });

  it("transactionally rolls back a late RAF scheduling failure", async () => {
    const previousAdvanceTime = vi.fn();
    const previousRenderText = vi.fn(() => '{"sentinel":true}');
    window.advanceTime = previousAdvanceTime;
    window.render_game_to_text = previousRenderText;
    const destroy = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);

    const failed = bootstrapApp({
      appRoot: harness.appRoot,
      requestAnimationFrame: vi.fn(() => {
        throw new Error("RAF unavailable");
      }),
      cancelAnimationFrame: harness.cancelAnimationFrame,
      scheduleIdleTask: harness.scheduleIdleTask,
      cancelIdleTask: harness.cancelIdleTask,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        prepare: vi.fn(),
        resume,
        update: vi.fn(),
        destroy,
      }),
    });

    expect(failed).toBeNull();
    expect(harness.appRoot.textContent).toContain("RAF unavailable");
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
    expect(window.advanceTime).toBe(previousAdvanceTime);
    expect(window.render_game_to_text).toBe(previousRenderText);
    expect(harness.pendingIdleTasks()).toBe(0);
    document.dispatchEvent(new Event("pointerdown"));
    expect(resume).not.toHaveBeenCalled();
  });

  it("handles automated stepping and startup failures from missing canvas support", async () => {
    const controller = createTestController({
      nav: { ...window.navigator, webdriver: true } as Navigator,
    });
    harness.flushAnimationFrames(16);
    expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);
    await controller.destroy();

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    const failed = bootstrapApp({ appRoot: harness.appRoot });
    expect(failed).toBeNull();
    expect(harness.appRoot.textContent).toContain("2D canvas context unavailable");
  });

  it("stops rescheduling through injected RAF after destroy", async () => {
    const controller = createTestController({
      nav: { ...window.navigator, webdriver: true } as Navigator,
    });

    expect(window.advanceTime).toBe(controller.advanceTime);
    expect(window.render_game_to_text).toBeTypeOf("function");

    harness.flushAnimationFrames(16);
    expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);

    await controller.destroy();
    expect(harness.pendingAnimationFrames()).toBe(0);
    expect(harness.pendingIdleTasks()).toBe(0);
    harness.flushAnimationFrames(32);

    expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(window.advanceTime).toBeUndefined();
    expect(window.render_game_to_text).toBeUndefined();

    controller.advanceTime(1000);
    expect(controller.state.elapsed).toBe(0);
  });

  it("disposes retained menu actions and makes menu synchronization inert", async () => {
    const controller = createTestController();
    const retainedStartButton =
      controller.menu.querySelector<HTMLButtonElement>("#start-btn");
    if (!retainedStartButton) {
      throw new Error("Start button missing from menu.");
    }

    await controller.destroy();
    retainedStartButton.click();
    controller.state.mode = "car_select";
    controller.syncMenu();

    expect(controller.state.session.playerBuild).toBeNull();
    expect(controller.menu.dataset.mode).toBe("menu");
    expect(controller.menu.textContent).toContain("Start Career Night");
  });
});
