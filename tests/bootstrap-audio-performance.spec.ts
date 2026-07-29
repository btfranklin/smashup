// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("bootstrap-audio-performance", () => {
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
    controller.state.cars[0].eliminationTime = controller.state.sessionElapsed;
    controller.state.cars.slice(2).forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = controller.state.sessionElapsed - index - 1;
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
    expect(
      record.mock.calls.some(
        (call) =>
          (call[0] as { phase: string; presented?: boolean }).phase ===
            "frame" &&
          (call[0] as { presented?: boolean }).presented === false,
      ),
    ).toBe(true);

    await controller.destroy();
    expect(destroyCollector).toHaveBeenCalledTimes(1);
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
});
