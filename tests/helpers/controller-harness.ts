import { vi } from "vitest";

import { createAppController } from "../../src/app/bootstrap";
import { createDomHarness } from "./dom-harness";

type AppController = ReturnType<typeof createAppController>;
export type ControllerOptions = Parameters<typeof createAppController>[0];

export function createControllerHarness() {
  delete window.advanceTime;
  delete window.render_game_to_text;
  window.history.replaceState({}, "", "/");

  const dom = createDomHarness();
  const controllers: AppController[] = [];

  function trackController(controller: AppController) {
    controllers.push(controller);
    return controller;
  }

  function createController(options: Partial<ControllerOptions> = {}) {
    return trackController(
      createAppController({
        appRoot: dom.appRoot,
        requestAnimationFrame: dom.requestAnimationFrame,
        cancelAnimationFrame: dom.cancelAnimationFrame,
        scheduleIdleTask: dom.scheduleIdleTask,
        cancelIdleTask: dom.cancelIdleTask,
        performanceNow: dom.performanceNow,
        createAudio: () => ({
          prepare: vi.fn(),
          resume: vi.fn().mockResolvedValue(undefined),
          update: vi.fn(),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
        ...options,
      }),
    );
  }

  return {
    dom,
    createController,
    trackController,
    async cleanup() {
      await Promise.all(controllers.map((controller) => controller.destroy()));
      dom.cleanup();
    },
  };
}
