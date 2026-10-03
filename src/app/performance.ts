import type { GameState, Mode } from "../game/types";

export type PerformancePhase =
  | "frame"
  | "simulation"
  | "audio"
  | "render"
  | "menu"
  | "skip";

export type PerformanceSample = {
  phase: PerformancePhase;
  timestampMs: number;
  durationMs: number;
  presented: boolean;
  frameIntervalMs: number | null;
  fixedSteps: number;
  droppedWallTimeMs: number;
  mode: Mode;
  collisionCount: number;
  hitStopActive: boolean;
  effects: {
    smoke: number;
    debris: number;
    dust: number;
    fragments: number;
  };
  scarCount: number;
  audioVoicesCreated: number;
  jsHeapBytes: number | null;
  jsHeapDeltaBytes: number | null;
  inferredGarbageCollection: boolean;
};

export type PerformanceTimelineEntry = {
  startTimeMs: number;
  durationMs: number;
  name: string;
};

export type PerformanceSnapshot = {
  capacity: number;
  droppedSamples: number;
  samples: PerformanceSample[];
  longTasks: PerformanceTimelineEntry[];
  garbageCollections: PerformanceTimelineEntry[];
};

export type PerformanceRecord = {
  phase: PerformancePhase;
  timestampMs: number;
  durationMs: number;
  state: GameState;
  presented?: boolean;
  frameIntervalMs?: number;
  fixedSteps?: number;
  droppedWallTimeMs?: number;
  audioVoicesCreated?: number;
};

export type PerformanceCollector = {
  record: (record: PerformanceRecord) => void;
  snapshot: () => PerformanceSnapshot;
  destroy: () => void;
};

export type PerformancePhaseSummary = {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

export type PerformanceSamplesSummary = {
  phases: Partial<Record<PerformancePhase, PerformancePhaseSummary>>;
  loadPeaks: {
    fixedSteps: number;
    droppedWallTimeMs: number;
    collisionCount: number;
    effects: {
      smoke: number;
      debris: number;
      dust: number;
      fragments: number;
      total: number;
    };
    scarCount: number;
    audioVoicesCreated: number;
    jsHeapBytes: number | null;
  };
  framePresentationCounts: {
    total: number;
    presented: number;
    skipped: number;
    zeroStep: number;
    zeroStepPresented: number;
  };
};

type HeapPerformance = Performance & {
  memory?: {
    usedJSHeapSize?: number;
  };
};

type ObserverFactory = (
  callback: PerformanceObserverCallback,
) => PerformanceObserver;

export type PerformanceCollectorOptions = {
  capacity?: number;
  timelineCapacity?: number;
  performance?: Performance;
  observerFactory?: ObserverFactory | null;
  supportedEntryTypes?: readonly string[];
};

const DEFAULT_SAMPLE_CAPACITY = 1_200;
const DEFAULT_TIMELINE_CAPACITY = 120;
const MAX_SAMPLE_CAPACITY = 10_000;
const MAX_TIMELINE_CAPACITY = 1_000;
const PERFORMANCE_PHASES: readonly PerformancePhase[] = [
  "frame",
  "simulation",
  "audio",
  "render",
  "menu",
  "skip",
];

function boundedCapacity(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`Collector capacity must be from 1 through ${maximum}.`);
  }
  return value;
}

function readHeapBytes(performanceTarget: Performance): number | null {
  const heapBytes = (performanceTarget as HeapPerformance).memory
    ?.usedJSHeapSize;
  return typeof heapBytes === "number" && Number.isFinite(heapBytes)
    ? heapBytes
    : null;
}

function captureStateContext(state: GameState): Pick<
  PerformanceSample,
  | "mode"
  | "collisionCount"
  | "hitStopActive"
  | "effects"
  | "scarCount"
> {
  let scarCount = 0;
  for (const car of state.cars) {
    scarCount += car.frame.scars.length;
  }
  return {
    mode: state.mode,
    collisionCount: state.recentCollisions.length,
    hitStopActive: state.camera.freezeTime > 0,
    effects: {
      smoke: state.smokePuffs.length,
      debris: state.debrisParticles.length,
      dust: state.dustPuffs.length,
      fragments: state.carFragments.length,
    },
    scarCount,
  };
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  const index = Math.max(0, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index] ?? 0;
}

export function summarizePerformanceSamples(
  samples: readonly PerformanceSample[],
): PerformanceSamplesSummary {
  const phases: PerformanceSamplesSummary["phases"] = {};
  for (const phase of PERFORMANCE_PHASES) {
    const durations = samples
      .filter((sample) => sample.phase === phase)
      .map((sample) => sample.durationMs)
      .sort((a, b) => a - b);
    if (durations.length === 0) {
      continue;
    }
    phases[phase] = {
      sampleCount: durations.length,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      p99Ms: percentile(durations, 0.99),
      maxMs: durations[durations.length - 1],
    };
  }

  const loadPeaks: PerformanceSamplesSummary["loadPeaks"] = {
    fixedSteps: 0,
    droppedWallTimeMs: 0,
    collisionCount: 0,
    effects: {
      smoke: 0,
      debris: 0,
      dust: 0,
      fragments: 0,
      total: 0,
    },
    scarCount: 0,
    audioVoicesCreated: 0,
    jsHeapBytes: null,
  };
  let totalFrames = 0;
  let presentedFrames = 0;
  let zeroStepFrames = 0;
  let zeroStepPresentedFrames = 0;
  for (const sample of samples) {
    loadPeaks.fixedSteps = Math.max(loadPeaks.fixedSteps, sample.fixedSteps);
    loadPeaks.droppedWallTimeMs = Math.max(
      loadPeaks.droppedWallTimeMs,
      sample.droppedWallTimeMs,
    );
    loadPeaks.collisionCount = Math.max(
      loadPeaks.collisionCount,
      sample.collisionCount,
    );
    loadPeaks.effects.smoke = Math.max(
      loadPeaks.effects.smoke,
      sample.effects.smoke,
    );
    loadPeaks.effects.debris = Math.max(
      loadPeaks.effects.debris,
      sample.effects.debris,
    );
    loadPeaks.effects.dust = Math.max(
      loadPeaks.effects.dust,
      sample.effects.dust,
    );
    loadPeaks.effects.fragments = Math.max(
      loadPeaks.effects.fragments,
      sample.effects.fragments,
    );
    loadPeaks.effects.total = Math.max(
      loadPeaks.effects.total,
      sample.effects.smoke +
        sample.effects.debris +
        sample.effects.dust +
        sample.effects.fragments,
    );
    loadPeaks.scarCount = Math.max(loadPeaks.scarCount, sample.scarCount);
    loadPeaks.audioVoicesCreated = Math.max(
      loadPeaks.audioVoicesCreated,
      sample.audioVoicesCreated,
    );
    if (sample.jsHeapBytes !== null) {
      loadPeaks.jsHeapBytes = Math.max(
        loadPeaks.jsHeapBytes ?? 0,
        sample.jsHeapBytes,
      );
    }
    if (sample.phase === "frame") {
      totalFrames += 1;
      if (sample.presented) {
        presentedFrames += 1;
      }
      if (sample.fixedSteps === 0) {
        zeroStepFrames += 1;
        if (sample.presented) {
          zeroStepPresentedFrames += 1;
        }
      }
    }
  }

  return {
    phases,
    loadPeaks,
    framePresentationCounts: {
      total: totalFrames,
      presented: presentedFrames,
      skipped: totalFrames - presentedFrames,
      zeroStep: zeroStepFrames,
      zeroStepPresented: zeroStepPresentedFrames,
    },
  };
}

function createRing<T>(capacity: number) {
  const entries = new Array<T>(capacity);
  let length = 0;
  let nextIndex = 0;
  let dropped = 0;

  return {
    push(entry: T): void {
      if (length === capacity) {
        dropped += 1;
      } else {
        length += 1;
      }
      entries[nextIndex] = entry;
      nextIndex = (nextIndex + 1) % capacity;
    },
    values(): T[] {
      if (length < capacity) {
        return entries.slice(0, length);
      }
      return [
        ...entries.slice(nextIndex),
        ...entries.slice(0, nextIndex),
      ];
    },
    dropped(): number {
      return dropped;
    },
  };
}

function timelineEntry(entry: PerformanceEntry): PerformanceTimelineEntry {
  return {
    startTimeMs: entry.startTime,
    durationMs: entry.duration,
    name: entry.name,
  };
}

export function createPerformanceCollector({
  capacity: requestedCapacity,
  timelineCapacity: requestedTimelineCapacity,
  performance: performanceTarget = globalThis.performance,
  observerFactory = typeof PerformanceObserver === "function"
    ? (callback) => new PerformanceObserver(callback)
    : null,
  supportedEntryTypes = typeof PerformanceObserver === "function"
    ? PerformanceObserver.supportedEntryTypes
    : [],
}: PerformanceCollectorOptions = {}): PerformanceCollector {
  const capacity = boundedCapacity(
    requestedCapacity,
    DEFAULT_SAMPLE_CAPACITY,
    MAX_SAMPLE_CAPACITY,
  );
  const timelineCapacity = boundedCapacity(
    requestedTimelineCapacity,
    DEFAULT_TIMELINE_CAPACITY,
    MAX_TIMELINE_CAPACITY,
  );
  const samples = createRing<PerformanceSample>(capacity);
  const longTasks = createRing<PerformanceTimelineEntry>(timelineCapacity);
  const garbageCollections =
    createRing<PerformanceTimelineEntry>(timelineCapacity);
  const observers: Array<{
    observer: PerformanceObserver;
    target: ReturnType<typeof createRing<PerformanceTimelineEntry>>;
  }> = [];
  let previousHeapBytes: number | null = null;
  let destroyed = false;

  function appendTimelineEntries(
    target: ReturnType<typeof createRing<PerformanceTimelineEntry>>,
    entries: PerformanceEntry[],
  ): void {
    for (const entry of entries) {
      target.push(timelineEntry(entry));
    }
  }

  function observe(
    entryType: "longtask" | "gc",
    target: ReturnType<typeof createRing<PerformanceTimelineEntry>>,
  ): void {
    if (!observerFactory || !supportedEntryTypes.includes(entryType)) {
      return;
    }
    try {
      const observer = observerFactory((list) => {
        if (destroyed) {
          return;
        }
        appendTimelineEntries(target, list.getEntries());
      });
      observer.observe({ entryTypes: [entryType] });
      observers.push({ observer, target });
    } catch {
      // Browser support lists can be optimistic. Samples remain useful without
      // optional timeline evidence.
    }
  }

  observe("longtask", longTasks);
  observe("gc", garbageCollections);

  return {
    record(record): void {
      if (destroyed) {
        return;
      }
      const heapBytes = readHeapBytes(performanceTarget);
      const heapDeltaBytes =
        heapBytes !== null && previousHeapBytes !== null
          ? heapBytes - previousHeapBytes
          : null;
      previousHeapBytes = heapBytes;
      const context = captureStateContext(record.state);
      samples.push({
        phase: record.phase,
        timestampMs: record.timestampMs,
        durationMs: Math.max(0, record.durationMs),
        presented: record.presented ?? false,
        frameIntervalMs: record.frameIntervalMs ?? null,
        fixedSteps: record.fixedSteps ?? 0,
        droppedWallTimeMs: Math.max(0, record.droppedWallTimeMs ?? 0),
        ...context,
        audioVoicesCreated: record.audioVoicesCreated ?? 0,
        jsHeapBytes: heapBytes,
        jsHeapDeltaBytes: heapDeltaBytes,
        inferredGarbageCollection:
          heapDeltaBytes !== null && heapDeltaBytes < 0,
      });
    },
    snapshot(): PerformanceSnapshot {
      for (const { observer, target } of observers) {
        appendTimelineEntries(target, observer.takeRecords());
      }
      return {
        capacity,
        droppedSamples: samples.dropped(),
        samples: samples.values(),
        longTasks: longTasks.values(),
        garbageCollections: garbageCollections.values(),
      };
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const { observer } of observers) {
        observer.disconnect();
      }
      observers.length = 0;
    },
  };
}
