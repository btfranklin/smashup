// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapApp } from "../src/app/bootstrap";
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

describe("bootstrap-lifecycle", () => {
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
    expect(controller.state.sessionElapsed).toBe(0);
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
