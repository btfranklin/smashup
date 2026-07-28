import { describe, expect, it, vi } from "vitest";

import {
  createAppLoop,
  FIXED_STEP_SECONDS,
  MAX_ADVANCE_TIME_MS,
  SPECTATOR_SKIP_MAX_STEPS,
  SPECTATOR_SKIP_MAX_STEPS_PER_BATCH,
  type AppLoopOptions,
} from "../src/app/loop";

function createLoopHarness(
  overrides: Partial<AppLoopOptions> = {},
) {
  let now = 0;
  let nextHandle = 1;
  let spectating = false;
  const frames: Array<{
    handle: number;
    callback: FrameRequestCallback;
  }> = [];
  const runStep = vi.fn();
  const runSpectatorStep = vi.fn();
  const finishSpectating = vi.fn(() => {
    spectating = false;
  });
  const afterSpectatorBatch = vi.fn();
  const present = vi.fn();
  const onSpectatorSkipActive = vi.fn();
  const recordPerformance = vi.fn();
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    frames.push({ handle, callback });
    return handle;
  });
  const cancelAnimationFrame = vi.fn((handle: number) => {
    const index = frames.findIndex((frame) => frame.handle === handle);
    if (index >= 0) {
      frames.splice(index, 1);
    }
  });
  const options: AppLoopOptions = {
    automatedStepping: false,
    requestAnimationFrame,
    cancelAnimationFrame,
    performanceNow: () => now,
    performanceEnabled: true,
    isSpectating: () => spectating,
    runStep,
    runSpectatorStep,
    finishSpectating,
    afterSpectatorBatch,
    present,
    onSpectatorSkipActive,
    recordPerformance,
    ...overrides,
  };
  const loop = createAppLoop(options);

  return {
    loop,
    runStep,
    runSpectatorStep,
    finishSpectating,
    afterSpectatorBatch,
    present,
    onSpectatorSkipActive,
    recordPerformance,
    requestAnimationFrame,
    cancelAnimationFrame,
    setSpectating(value: boolean) {
      spectating = value;
    },
    setNow(value: number) {
      now = value;
    },
    flushFrame(timestamp = now) {
      const frame = frames.shift();
      if (!frame) {
        throw new Error("No animation frame is pending.");
      }
      frame.callback(timestamp);
    },
    pendingFrames() {
      return frames.length;
    },
  };
}

describe("app loop", () => {
  it("advances fixed steps with partition-independent fractional carry", () => {
    const whole = createLoopHarness();
    whole.loop.advanceTime(1_000);
    expect(whole.runStep).toHaveBeenCalledTimes(60);
    expect(whole.present).toHaveBeenCalledTimes(1);
    expect(whole.runStep).toHaveBeenCalledWith(FIXED_STEP_SECONDS, false);

    const partitioned = createLoopHarness();
    for (const duration of [7.5, 12.5, 80, 100, 200, 300, 125, 175]) {
      partitioned.loop.advanceTime(duration);
    }
    expect(partitioned.runStep).toHaveBeenCalledTimes(60);

    for (const invalid of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      MAX_ADVANCE_TIME_MS + 0.001,
    ]) {
      expect(() => whole.loop.advanceTime(invalid)).toThrow(RangeError);
    }
  });

  it("caps wall-clock catch-up and records dropped time", () => {
    const harness = createLoopHarness();
    harness.loop.start();
    harness.setNow(100);
    harness.flushFrame(100);

    expect(harness.runStep).toHaveBeenCalledTimes(3);
    expect(harness.runStep).toHaveBeenCalledWith(FIXED_STEP_SECONDS, true);
    expect(harness.present).toHaveBeenCalledTimes(1);
    expect(harness.recordPerformance).toHaveBeenCalledWith(
      "frame",
      100,
      expect.objectContaining({
        fixedSteps: 3,
        droppedWallTimeMs: 50,
      }),
    );
  });

  it("coalesces requested paints across reset and automated frames", () => {
    const normal = createLoopHarness();
    normal.loop.start();
    normal.setNow(10_000);
    normal.loop.resetClock();
    normal.loop.requestPresentation();
    normal.flushFrame(10_000);
    expect(normal.runStep).not.toHaveBeenCalled();
    expect(normal.present).toHaveBeenCalledTimes(1);
    expect(normal.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      10_000,
      expect.objectContaining({ presented: true }),
    );

    const automated = createLoopHarness({ automatedStepping: true });
    automated.loop.start();
    automated.setNow(1_000);
    automated.flushFrame(1_000);
    expect(automated.runStep).not.toHaveBeenCalled();
    expect(automated.present).not.toHaveBeenCalled();

    automated.loop.requestPresentation();
    automated.loop.requestPresentation();
    automated.flushFrame(1_016);
    expect(automated.present).toHaveBeenCalledTimes(1);
    expect(automated.pendingFrames()).toBe(1);
    expect(automated.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      1_000,
      expect.objectContaining({ presented: true }),
    );

    automated.flushFrame(1_032);
    expect(automated.present).toHaveBeenCalledTimes(1);
    expect(automated.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      1_000,
      expect.objectContaining({ presented: false }),
    );
  });

  it("skips zero-step paints unless requested and always paints stepped frames", () => {
    const harness = createLoopHarness();
    harness.loop.start();

    harness.setNow(8);
    harness.flushFrame(8);
    expect(harness.runStep).not.toHaveBeenCalled();
    expect(harness.present).not.toHaveBeenCalled();
    expect(harness.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      8,
      expect.objectContaining({
        fixedSteps: 0,
        presented: false,
      }),
    );

    harness.loop.requestPresentation();
    harness.loop.requestPresentation();
    harness.setNow(16);
    harness.flushFrame(16);
    expect(harness.runStep).not.toHaveBeenCalled();
    expect(harness.present).toHaveBeenCalledTimes(1);
    expect(harness.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      16,
      expect.objectContaining({
        fixedSteps: 0,
        presented: true,
      }),
    );

    harness.setNow(24);
    harness.flushFrame(24);
    expect(harness.runStep).toHaveBeenCalledTimes(1);
    expect(harness.present).toHaveBeenCalledTimes(2);
    expect(harness.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      24,
      expect.objectContaining({
        fixedSteps: 1,
        presented: true,
      }),
    );
  });

  it("presents deterministic advancement immediately without a guard-frame repaint", () => {
    const harness = createLoopHarness();
    harness.loop.start();
    harness.loop.requestPresentation();

    harness.loop.advanceTime(1_000 / 60);
    expect(harness.runStep).toHaveBeenCalledTimes(1);
    expect(harness.present).toHaveBeenCalledTimes(1);

    harness.flushFrame();
    expect(harness.present).toHaveBeenCalledTimes(1);
    expect(harness.recordPerformance).toHaveBeenLastCalledWith(
      "frame",
      0,
      expect.objectContaining({ presented: false }),
    );
  });

  it("yields spectator work in bounded batches and stops at the exact cap", () => {
    const harness = createLoopHarness();
    harness.setSpectating(true);
    harness.loop.startSpectatorSkip();

    for (
      let batch = 0;
      batch < 100 && harness.finishSpectating.mock.calls.length === 0;
      batch += 1
    ) {
      harness.flushFrame();
    }

    expect(harness.runSpectatorStep).toHaveBeenCalledTimes(
      SPECTATOR_SKIP_MAX_STEPS,
    );
    expect(harness.finishSpectating).toHaveBeenCalledTimes(1);
    expect(harness.afterSpectatorBatch).toHaveBeenCalledTimes(
      SPECTATOR_SKIP_MAX_STEPS /
        SPECTATOR_SKIP_MAX_STEPS_PER_BATCH,
    );
    expect(harness.onSpectatorSkipActive).toHaveBeenNthCalledWith(1, true);
    expect(harness.onSpectatorSkipActive).toHaveBeenLastCalledWith(false);
    const skipSamples = harness.recordPerformance.mock.calls.filter(
      ([phase]) => phase === "skip",
    );
    expect(
      skipSamples.every(
        ([, , details]) =>
          (details as { fixedSteps: number }).fixedSteps <=
          SPECTATOR_SKIP_MAX_STEPS_PER_BATCH,
      ),
    ).toBe(true);
  });

  it("honors the skip time budget and resumes if spectating ends before work", () => {
    let now = 0;
    const budgetedStep = vi.fn(() => {
      now += 9;
    });
    const budgeted = createLoopHarness({
      performanceNow: () => now,
      runSpectatorStep: budgetedStep,
    });
    budgeted.setSpectating(true);
    budgeted.loop.startSpectatorSkip();
    budgeted.flushFrame();
    expect(budgetedStep).toHaveBeenCalledTimes(1);
    expect(budgeted.pendingFrames()).toBe(1);
    budgeted.loop.destroy();

    const ended = createLoopHarness();
    ended.setSpectating(true);
    ended.loop.startSpectatorSkip();
    ended.setSpectating(false);
    ended.flushFrame();
    expect(ended.runSpectatorStep).not.toHaveBeenCalled();
    expect(ended.onSpectatorSkipActive).toHaveBeenLastCalledWith(false);
    expect(ended.pendingFrames()).toBe(1);
  });

  it("cancels pending work and ignores all entry points after destruction", () => {
    const harness = createLoopHarness();
    harness.loop.start();
    expect(harness.pendingFrames()).toBe(1);

    harness.loop.destroy();
    harness.loop.destroy();
    harness.loop.start();
    harness.loop.requestPresentation();
    harness.loop.presentNow();
    harness.loop.advanceTime(1_000);
    harness.setSpectating(true);
    harness.loop.startSpectatorSkip();

    expect(harness.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(harness.pendingFrames()).toBe(0);
    expect(harness.runStep).not.toHaveBeenCalled();
    expect(harness.runSpectatorStep).not.toHaveBeenCalled();
    expect(harness.present).not.toHaveBeenCalled();
  });

  it("continues cleanup when a frame cancellation fails", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const harness = createLoopHarness({
      cancelAnimationFrame: vi.fn(() => {
        throw new Error("cancel failed");
      }),
    });
    harness.loop.start();

    expect(() => harness.loop.destroy()).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to cancel an animation frame.",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
