import { describe, expect, it, vi } from "vitest";

import {
  createPerformanceCollector,
  summarizePerformanceSamples,
} from "../src/app/performance";
import { createInitialState } from "../src/game/session";

describe("bounded performance collector", () => {
  it("retains the newest state-rich samples and reports overwritten entries", () => {
    const state = createInitialState();
    state.recentCollisions = [
      {
        aId: 0,
        bId: 1,
        aActiveAtImpact: true,
        bActiveAtImpact: true,
        aDisabledByImpact: false,
        bDisabledByImpact: false,
        point: { x: 0, y: 0 },
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: 0 },
        normal: { x: 1, y: 0 },
        severity: 0.6,
        damageSeverity: 0.5,
        damageTakenA: 0.4,
        damageTakenB: 0.5,
        zoneA: "front",
        zoneB: "rear",
        deformationA: 0.2,
        deformationB: 0.3,
      },
    ];
    state.camera.freezeTime = 0.02;
    state.smokePuffs.length = 1;
    state.carFragments.length = 2;
    state.cars[0].frame.scars.push({
      id: 1,
      x: 0,
      y: 0,
      angle: 0,
      length: 1,
      depth: 1,
      width: 1,
    });
    const collector = createPerformanceCollector({
      capacity: 2,
      observerFactory: null,
      supportedEntryTypes: [],
      performance: {} as Performance,
    });

    for (let index = 0; index < 3; index += 1) {
      collector.record({
        phase: "simulation",
        timestampMs: index * 10,
        durationMs: index + 1,
        state,
        fixedSteps: index + 1,
        audioVoicesCreated: 3,
      });
    }

    const snapshot = collector.snapshot();
    expect(snapshot.droppedSamples).toBe(1);
    expect(snapshot.samples.map((sample) => sample.timestampMs)).toEqual([
      10, 20,
    ]);
    expect(snapshot.samples[1]).toMatchObject({
      phase: "simulation",
      fixedSteps: 3,
      collisionCount: 1,
      hitStopActive: true,
      presented: false,
      effects: {
        smoke: 1,
        debris: 0,
        dust: 0,
        fragments: 2,
      },
      scarCount: 1,
      audioVoicesCreated: 3,
    });
  });

  it("captures heap deltas and infers supported garbage-collection evidence", () => {
    const state = createInitialState();
    const performanceTarget = {
      memory: { usedJSHeapSize: 1_000 },
    } as unknown as Performance & {
      memory: { usedJSHeapSize: number };
    };
    const collector = createPerformanceCollector({
      performance: performanceTarget,
      observerFactory: null,
      supportedEntryTypes: [],
    });

    collector.record({
      phase: "frame",
      timestampMs: 0,
      durationMs: 2,
      state,
    });
    performanceTarget.memory.usedJSHeapSize = 600;
    collector.record({
      phase: "frame",
      timestampMs: 16,
      durationMs: 3,
      state,
      frameIntervalMs: 16,
      droppedWallTimeMs: 4,
    });

    expect(collector.snapshot().samples[1]).toMatchObject({
      presented: false,
      jsHeapBytes: 600,
      jsHeapDeltaBytes: -400,
      inferredGarbageCollection: true,
      frameIntervalMs: 16,
      droppedWallTimeMs: 4,
    });
  });

  it("summarizes phase percentiles, load peaks, and zero-step presentation cadence", () => {
    const state = createInitialState();
    const performanceTarget = {
      memory: { usedJSHeapSize: 1_000 },
    } as unknown as Performance & {
      memory: { usedJSHeapSize: number };
    };
    const collector = createPerformanceCollector({
      performance: performanceTarget,
      observerFactory: null,
      supportedEntryTypes: [],
    });

    for (const [index, durationMs] of [1, 2, 3, 4, 20].entries()) {
      state.smokePuffs.length = index;
      state.debrisParticles.length = index + 1;
      state.dustPuffs.length = index + 2;
      state.carFragments.length = index + 3;
      state.cars[0].frame.scars.length = index;
      performanceTarget.memory.usedJSHeapSize = 1_000 + index * 100;
      collector.record({
        phase: "simulation",
        timestampMs: index * 10,
        durationMs,
        state,
        fixedSteps: index + 1,
        droppedWallTimeMs: index * 2,
        audioVoicesCreated: index + 2,
      });
    }
    collector.record({
      phase: "frame",
      timestampMs: 60,
      durationMs: 2,
      state,
      fixedSteps: 0,
      presented: false,
    });
    collector.record({
      phase: "frame",
      timestampMs: 70,
      durationMs: 4,
      state,
      fixedSteps: 0,
      presented: true,
    });
    collector.record({
      phase: "frame",
      timestampMs: 80,
      durationMs: 6,
      state,
      fixedSteps: 1,
      presented: true,
    });

    const samples = collector.snapshot().samples;
    const originalSamples = JSON.stringify(samples);
    expect(summarizePerformanceSamples(samples)).toEqual({
      phases: {
        frame: {
          sampleCount: 3,
          p50Ms: 4,
          p95Ms: 6,
          p99Ms: 6,
          maxMs: 6,
        },
        simulation: {
          sampleCount: 5,
          p50Ms: 3,
          p95Ms: 20,
          p99Ms: 20,
          maxMs: 20,
        },
      },
      loadPeaks: {
        fixedSteps: 5,
        droppedWallTimeMs: 8,
        collisionCount: 0,
        effects: {
          smoke: 4,
          debris: 5,
          dust: 6,
          fragments: 7,
          total: 22,
        },
        scarCount: 4,
        audioVoicesCreated: 6,
        jsHeapBytes: 1_400,
      },
      framePresentationCounts: {
        total: 3,
        presented: 2,
        skipped: 1,
        zeroStep: 2,
        zeroStepPresented: 1,
      },
    });
    expect(JSON.stringify(samples)).toBe(originalSamples);
    expect(summarizePerformanceSamples([])).toEqual({
      phases: {},
      loadPeaks: {
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
      },
      framePresentationCounts: {
        total: 0,
        presented: 0,
        skipped: 0,
        zeroStep: 0,
        zeroStepPresented: 0,
      },
    });
  });

  it("records supported timeline entries and disconnects observers exactly once", () => {
    const callbacks: PerformanceObserverCallback[] = [];
    const disconnect = vi.fn();
    const collector = createPerformanceCollector({
      observerFactory: (callback) => {
        callbacks.push(callback);
        return {
          disconnect,
          observe: vi.fn(),
          takeRecords: () => [],
        } as unknown as PerformanceObserver;
      },
      supportedEntryTypes: ["longtask", "gc"],
    });
    const entries = [
      {
        name: "script",
        entryType: "longtask",
        startTime: 4,
        duration: 55,
        toJSON: () => ({}),
      },
    ] satisfies PerformanceEntry[];

    callbacks[0]?.(
      {
        getEntries: () => entries,
      } as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    );
    callbacks[1]?.(
      {
        getEntries: () => [
          {
            ...entries[0],
            name: "major",
            entryType: "gc",
            duration: 8,
          },
        ],
      } as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    );

    expect(collector.snapshot().longTasks).toEqual([
      { name: "script", startTimeMs: 4, durationMs: 55 },
    ]);
    expect(collector.snapshot().garbageCollections).toEqual([
      { name: "major", startTimeMs: 4, durationMs: 8 },
    ]);

    collector.destroy();
    collector.destroy();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("drains queued timeline entries into their bounded rings before snapshot", () => {
    const callbacks: PerformanceObserverCallback[] = [];
    const queuedEntries: PerformanceEntry[][] = [];
    const takeRecords: Array<ReturnType<typeof vi.fn>> = [];
    const collector = createPerformanceCollector({
      timelineCapacity: 2,
      observerFactory: (callback) => {
        const queued: PerformanceEntry[] = [];
        const takeQueuedRecords = vi.fn(() => queued.splice(0));
        callbacks.push(callback);
        queuedEntries.push(queued);
        takeRecords.push(takeQueuedRecords);
        return {
          disconnect: vi.fn(),
          observe: vi.fn(),
          takeRecords: takeQueuedRecords,
        } as unknown as PerformanceObserver;
      },
      supportedEntryTypes: ["longtask", "gc"],
    });
    function entry(entryType: string, index: number): PerformanceEntry {
      return {
        name: `${entryType}-${index}`,
        entryType,
        startTime: index * 10,
        duration: entryType === "longtask" ? 50 + index : index,
        toJSON: () => ({}),
      };
    }

    for (const [observerIndex, entryType] of ["longtask", "gc"].entries()) {
      callbacks[observerIndex](
        { getEntries: () => [entry(entryType, 1)] } as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      );
      queuedEntries[observerIndex].push(
        entry(entryType, 2),
        entry(entryType, 3),
        entry(entryType, 4),
      );
    }

    const snapshot = collector.snapshot();
    expect(snapshot.longTasks).toEqual([
      { name: "longtask-3", startTimeMs: 30, durationMs: 53 },
      { name: "longtask-4", startTimeMs: 40, durationMs: 54 },
    ]);
    expect(snapshot.garbageCollections).toEqual([
      { name: "gc-3", startTimeMs: 30, durationMs: 3 },
      { name: "gc-4", startTimeMs: 40, durationMs: 4 },
    ]);
    expect(queuedEntries).toEqual([[], []]);
    expect(collector.snapshot()).toEqual(snapshot);
    takeRecords.forEach((takeQueuedRecords) => {
      expect(takeQueuedRecords).toHaveBeenCalledTimes(2);
    });
    collector.destroy();
    expect(collector.snapshot()).toEqual(snapshot);
    takeRecords.forEach((takeQueuedRecords) => {
      expect(takeQueuedRecords).toHaveBeenCalledTimes(2);
    });
  });

  it("rejects unbounded capacities", () => {
    expect(() => createPerformanceCollector({ capacity: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      createPerformanceCollector({ timelineCapacity: 1_001 }),
    ).toThrow(RangeError);
  });
});
