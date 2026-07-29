// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapApp,
  createAppController,
} from "../src/app/bootstrap";
import { chooseStarterCar } from "../src/game/session";
import {
  createControllerHarness,
  type ControllerOptions,
} from "./helpers/controller-harness";

let controllerHarness: ReturnType<typeof createControllerHarness>;
let harness: ReturnType<typeof createControllerHarness>["dom"];

beforeEach(() => {
  controllerHarness = createControllerHarness();
  harness = controllerHarness.dom;
});

afterEach(async () => {
  await controllerHarness.cleanup();
});

function createTestController(
  options: Partial<ControllerOptions> = {},
) {
  return controllerHarness.createController(options);
}

describe("bootstrap-input-platform", () => {
  it("applies canvas display size from the supplied rectangle", () => {
    const controller = createTestController();

    harness.setContainerSize(600, 400);
    controller.resizeCanvas();
    expect(controller.canvas.style.width).toBe("600px");
    expect(controller.canvas.style.height).toBe("360px");
  });

  it("coalesces resize and session invalidations while preserving immediate presentation", () => {
    const controller = createTestController({
      nav: { ...window.navigator, webdriver: true } as Navigator,
    });
    const initialPaints = harness.canvas.count("clearRect");

    harness.flushAnimationFrames(16);
    expect(harness.canvas.count("clearRect")).toBe(initialPaints);

    controller.resizeCanvas();
    controller.resizeCanvas();
    harness.flushAnimationFrames(32);
    expect(harness.canvas.count("clearRect")).toBe(initialPaints + 1);

    harness.flushAnimationFrames(48);
    expect(harness.canvas.count("clearRect")).toBe(initialPaints + 1);

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.flushAnimationFrames(64);
    expect(controller.state.mode).toBe("car_select");
    expect(harness.canvas.count("clearRect")).toBe(initialPaints + 2);

    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    harness.flushAnimationFrames(80);
    expect(controller.state.mode).toBe("intro");
    expect(harness.canvas.count("clearRect")).toBe(initialPaints + 3);

    controller.present();
    expect(harness.canvas.count("clearRect")).toBe(initialPaints + 4);
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
      controllerHarness.trackController(controller);

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
});
