import type { PerformancePhase } from "./performance";

export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_ADVANCE_TIME_MS = 120_000;
export const SPECTATOR_SKIP_MAX_STEPS = 90 * 60;
export const SPECTATOR_SKIP_MAX_STEPS_PER_BATCH = 60;
export const SPECTATOR_SKIP_FRAME_BUDGET_MS = 2;

export type LoopPerformanceDetails = {
  frameIntervalMs?: number;
  fixedSteps?: number;
  droppedWallTimeMs?: number;
  presented?: boolean;
};

export type AppLoop = {
  start: () => void;
  destroy: () => void;
  resetClock: () => void;
  requestPresentation: () => void;
  presentNow: () => void;
  advanceTime: (ms: number) => void;
  startSpectatorSkip: () => void;
};

export type AppLoopOptions = {
  automatedStepping: boolean;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  performanceNow: () => number;
  performanceEnabled?: boolean;
  isSpectating: () => boolean;
  runStep: (dt: number, waitForAudio: boolean) => void;
  runSpectatorStep: (dt: number) => void;
  finishSpectating: () => void;
  afterSpectatorBatch: () => void;
  present: () => void;
  onSpectatorSkipActive: (active: boolean) => void;
  recordPerformance: (
    phase: PerformancePhase,
    startedAt: number,
    details?: LoopPerformanceDetails,
  ) => void;
};

function validateAdvanceDuration(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_ADVANCE_TIME_MS) {
    throw new RangeError(
      `advanceTime(ms) requires a finite duration from 0 through ${MAX_ADVANCE_TIME_MS}.`,
    );
  }
}

export function createAppLoop({
  automatedStepping,
  requestAnimationFrame,
  cancelAnimationFrame,
  performanceNow,
  performanceEnabled = false,
  isSpectating,
  runStep,
  runSpectatorStep,
  finishSpectating,
  afterSpectatorBatch,
  present,
  onSpectatorSkipActive,
  recordPerformance,
}: AppLoopOptions): AppLoop {
  const scheduledFrames = new Set<number>();
  let started = false;
  let destroyed = false;
  let spectatorSkipActive = false;
  let lastTime = performanceNow();
  let wallClockAccumulator = 0;
  let automationStepRemainder = 0;
  let skipNextFrameCatchup = false;
  let lastFrameTimestamp: number | null = null;
  let presentationPending = false;

  function performanceStart(): number {
    return performanceEnabled ? performanceNow() : 0;
  }

  function scheduleFrame(callback: FrameRequestCallback): number {
    let handle = 0;
    handle = requestAnimationFrame((now) => {
      scheduledFrames.delete(handle);
      callback(now);
    });
    scheduledFrames.add(handle);
    return handle;
  }

  function scheduleNextFrame(): void {
    if (!destroyed) {
      scheduleFrame(frameLoop);
    }
  }

  function setSpectatorSkipActive(active: boolean): void {
    spectatorSkipActive = active;
    onSpectatorSkipActive(active);
  }

  function requestPresentation(): void {
    if (!destroyed) {
      presentationPending = true;
    }
  }

  function presentNow(): void {
    if (destroyed) {
      return;
    }
    presentationPending = false;
    present();
  }

  function presentIfRequested(): boolean {
    if (!presentationPending) {
      return false;
    }
    presentNow();
    return true;
  }

  function resetClock(): void {
    wallClockAccumulator = 0;
    automationStepRemainder = 0;
    lastTime = performanceNow();
    lastFrameTimestamp = null;
    skipNextFrameCatchup = true;
    requestPresentation();
  }

  function finishSkipBatch(
    batchStartedAt: number,
    completedSteps: number,
  ): void {
    setSpectatorSkipActive(false);
    resetClock();
    presentNow();
    recordPerformance("skip", batchStartedAt, {
      fixedSteps: completedSteps,
    });
    scheduleNextFrame();
  }

  function startSpectatorSkip(): void {
    if (destroyed || spectatorSkipActive || !isSpectating()) {
      return;
    }

    setSpectatorSkipActive(true);
    let remainingSteps = SPECTATOR_SKIP_MAX_STEPS;

    const runBatch = () => {
      if (destroyed) {
        return;
      }
      if (!isSpectating()) {
        setSpectatorSkipActive(false);
        resetClock();
        scheduleNextFrame();
        return;
      }

      const batchStartedAt = performanceNow();
      const simulationStartedAt = performanceStart();
      let completedSteps = 0;
      while (
        completedSteps < SPECTATOR_SKIP_MAX_STEPS_PER_BATCH &&
        remainingSteps > 0 &&
        isSpectating()
      ) {
        runSpectatorStep(FIXED_STEP_SECONDS);
        completedSteps += 1;
        if (
          performanceNow() - batchStartedAt >=
          SPECTATOR_SKIP_FRAME_BUDGET_MS
        ) {
          break;
        }
      }
      remainingSteps -= completedSteps;
      recordPerformance("simulation", simulationStartedAt, {
        fixedSteps: completedSteps,
      });

      if (isSpectating() && remainingSteps <= 0) {
        finishSpectating();
      }
      afterSpectatorBatch();

      if (isSpectating()) {
        presentNow();
        recordPerformance("skip", batchStartedAt, {
          fixedSteps: completedSteps,
        });
        scheduleFrame(runBatch);
        return;
      }

      finishSkipBatch(batchStartedAt, completedSteps);
    };

    scheduleFrame(runBatch);
  }

  function advanceTime(ms: number): void {
    validateAdvanceDuration(ms);
    if (destroyed) {
      return;
    }

    wallClockAccumulator = 0;
    lastTime = performanceNow();
    skipNextFrameCatchup = true;
    if (ms === 0) {
      return;
    }

    const availableSteps =
      automationStepRemainder + ms / (FIXED_STEP_SECONDS * 1000);
    const steps = Math.floor(availableSteps + 1e-9);
    automationStepRemainder = availableSteps - steps;
    if (Math.abs(automationStepRemainder) < 1e-9) {
      automationStepRemainder = 0;
    }
    for (let index = 0; index < steps; index += 1) {
      runStep(FIXED_STEP_SECONDS, false);
    }
    if (steps > 0) {
      presentNow();
    }
  }

  function frameLoop(now: number): void {
    if (destroyed) {
      return;
    }
    const frameStartedAt = performanceStart();
    const frameIntervalMs =
      lastFrameTimestamp === null ? undefined : now - lastFrameTimestamp;
    lastFrameTimestamp = now;
    if (spectatorSkipActive) {
      lastTime = now;
      wallClockAccumulator = 0;
      recordPerformance("frame", frameStartedAt, {
        frameIntervalMs,
        presented: false,
      });
      return;
    }
    if (automatedStepping) {
      lastTime = now;
      wallClockAccumulator = 0;
      const presented = presentIfRequested();
      scheduleNextFrame();
      recordPerformance("frame", frameStartedAt, {
        frameIntervalMs,
        presented,
      });
      return;
    }
    if (skipNextFrameCatchup) {
      lastTime = now;
      wallClockAccumulator = 0;
      skipNextFrameCatchup = false;
      const presented = presentIfRequested();
      scheduleNextFrame();
      recordPerformance("frame", frameStartedAt, {
        frameIntervalMs,
        presented,
      });
      return;
    }

    const rawDeltaMs = Math.max(0, now - lastTime);
    const delta = Math.min(0.05, rawDeltaMs / 1000);
    lastTime = now;
    wallClockAccumulator += delta;
    let fixedSteps = 0;
    while (wallClockAccumulator >= FIXED_STEP_SECONDS) {
      runStep(FIXED_STEP_SECONDS, true);
      wallClockAccumulator -= FIXED_STEP_SECONDS;
      fixedSteps += 1;
    }
    let presented = false;
    if (fixedSteps > 0) {
      presentNow();
      presented = true;
    } else {
      presented = presentIfRequested();
    }
    scheduleNextFrame();
    recordPerformance("frame", frameStartedAt, {
      frameIntervalMs,
      fixedSteps,
      droppedWallTimeMs: Math.max(0, rawDeltaMs - 50),
      presented,
    });
  }

  return {
    start(): void {
      if (started || destroyed) {
        return;
      }
      started = true;
      scheduleNextFrame();
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      if (spectatorSkipActive) {
        setSpectatorSkipActive(false);
      }
      for (const handle of scheduledFrames) {
        try {
          cancelAnimationFrame(handle);
        } catch (error) {
          console.error("Unable to cancel an animation frame.", error);
        }
      }
      scheduledFrames.clear();
    },
    resetClock,
    requestPresentation,
    presentNow,
    advanceTime,
    startSpectatorSkip,
  };
}
