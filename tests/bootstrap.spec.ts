// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapApp,
  computeCanvasDisplaySize,
  createAppController,
  createStateForSearch,
  installBrowserHooks,
  renderStartupError,
  setInputKeyState,
  shouldHideMenu,
} from "../src/app/bootstrap";
import { PLACEMENT_POINTS } from "../src/game/career";
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
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
      ...options,
    });
    controllers.push(controller);
    return controller;
  }

  it("renders a visible startup error for invalid preview params and does not install hooks", () => {
    window.history.replaceState(
      {},
      "",
      "/?preview=car&preset=bad-car&scenario=pristine",
    );

    const controller = bootstrapApp({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
    });

    expect(controller).toBeNull();
    expect(harness.appRoot.textContent).toContain("Startup Error");
    expect(harness.appRoot.textContent).toContain("Invalid car preview preset");
    expect(window.render_game_to_text).toBeUndefined();
  });

  it("boots the normal app shell with frame, canvas, and menu", () => {
    const controller = createTestController();

    expect(harness.appRoot.contains(controller.frame)).toBe(true);
    expect(controller.canvas.getAttribute("aria-label")).toContain("arena");
    expect(controller.menu.textContent).toContain("Start Career Night");
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

  it("reports rejected audio activation without an unhandled promise", async () => {
    const activationError = new Error("Audio activation failed.");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createTestController({
      createAudio: () => ({
        ensureStarted: vi.fn().mockRejectedValue(activationError),
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
          roundIndex: index + 1,
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
          roundIndex: index + 1,
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
    harness.flushAnimationFrames(32);

    expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(window.advanceTime).toBeUndefined();
    expect(window.render_game_to_text).toBeUndefined();

    controller.advanceTime(1000);
    expect(controller.state.elapsed).toBe(0);
  });
});
