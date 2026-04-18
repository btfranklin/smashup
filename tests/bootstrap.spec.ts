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
import { createDomHarness } from "./helpers/dom-harness";
import { parsePayload } from "./helpers/payload-assertions";

describe("bootstrap and app controller", () => {
  let harness: ReturnType<typeof createDomHarness>;

  beforeEach(() => {
    delete window.advanceTime;
    delete window.render_game_to_text;
    window.history.replaceState({}, "", "/");
    harness = createDomHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

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
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    expect(harness.appRoot.contains(controller.frame)).toBe(true);
    expect(controller.canvas.getAttribute("aria-label")).toContain("arena");
    expect(controller.menu.textContent).toContain("Start Tournament");
    expect(window.advanceTime).toBeTypeOf("function");
    expect(window.render_game_to_text).toBeTypeOf("function");
  });

  it("boots preview mode with hidden menu content", () => {
    window.history.replaceState(
      {},
      "",
      "/?preview=car&preset=bulldozer&scenario=critical",
    );

    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    expect(controller.state.mode).toBe("car_preview");
    expect(controller.menu.hidden).toBe(true);
    expect(controller.menu.textContent?.trim()).toBe("");
    expect(controller.menu.querySelector("button")).toBeNull();
  });

  it("advances from menu to car select and then into the round intro", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    expect(controller.state.mode).toBe("car_select");

    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.playerBuild?.presetId).toBe("bulldozer");
  });

  it("keeps advanceTime deterministic and installs render_game_to_text", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    window.advanceTime(3500);

    const payload = parsePayload(window.render_game_to_text());
    expect(controller.state.mode).toBe("running");
    expect(payload.mode).toBe("running");
    expect((payload.session as { selectedPreset: string }).selectedPreset).toBe(
      "bulldozer",
    );
  });

  it("recomputes canvas display size on resize", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    harness.setContainerSize(600, 400);
    controller.resizeCanvas();
    expect(controller.canvas.style.width).toBe("600px");
    expect(controller.canvas.style.height).toBe("360px");
  });

  it("routes fullscreen toggles through the frame and document APIs", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });
    harness.attachFullscreenStub(controller.frame);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    const requestFullscreen = controller.frame
      .requestFullscreen as unknown as ReturnType<typeof vi.fn>;
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    expect(harness.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("tracks keyboard input state through keydown and keyup", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

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
    expect(window.render_game_to_text()).toBe("{}");

    renderStartupError(harness.appRoot, "Broken");
    expect(harness.appRoot.textContent).toContain("Broken");
    expect(createStateForSearch("?preview=car&preset=bulldozer&scenario=pristine").mode).toBe(
      "car_preview",
    );
  });

  it("renders round-results and upgrade flows through the menu", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    controller.state.mode = "round_results";
    controller.state.session.lastRoundSummary = {
      roundIndex: 1,
      title: "Dust Bowl",
      playerWon: true,
      winnerLabel: "Player",
      survivalTime: 10,
      eliminatedByLabel: null,
      playerKnockouts: ["Rimshot"],
      biggestHitLabel: "Player into Rimshot",
      biggestHitSeverity: 0.9,
      knockoutReason: null,
    };
    controller.syncMenu();
    expect(controller.menu.textContent).toContain("Round 1");
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

  it("renders tournament-over flow and supports keyboard restart", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });

    controller.state.mode = "tournament_over";
    controller.state.session.completedRounds = [
      {
        roundIndex: 1,
        title: "Dust Bowl",
        playerWon: false,
        winnerLabel: "Rimshot",
        survivalTime: 8,
        eliminatedByLabel: "Rimshot",
        playerKnockouts: [],
        biggestHitLabel: null,
        biggestHitSeverity: 0.4,
        knockoutReason: "Engine Failure",
      },
    ];
    controller.state.cars[0].disabled = true;
    controller.syncMenu();

    expect(controller.menu.textContent).toContain("Tournament");
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
    expect(controller.state.mode).toBe("menu");
  });

  it("handles automated stepping and startup failures from missing canvas support", () => {
    const controller = createAppController({
      appRoot: harness.appRoot,
      nav: { ...window.navigator, webdriver: true } as Navigator,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      createAudio: () => ({
        ensureStarted: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
      }),
    });
    harness.flushAnimationFrames(16);
    expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);
    controller.destroy();

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    const failed = bootstrapApp({ appRoot: harness.appRoot });
    expect(failed).toBeNull();
    expect(harness.appRoot.textContent).toContain("2D canvas context unavailable");
  });
});
