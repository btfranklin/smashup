import { describe, expect, it, vi } from "vitest";

import { createPerformanceCollector } from "../src/app/performance";
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
    } as unknown as Performance;
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
    (
      performanceTarget as Performance & {
        memory: { usedJSHeapSize: number };
      }
    ).memory.usedJSHeapSize = 600;
    collector.record({
      phase: "frame",
      timestampMs: 16,
      durationMs: 3,
      state,
      frameIntervalMs: 16,
      droppedWallTimeMs: 4,
    });

    expect(collector.snapshot().samples[1]).toMatchObject({
      jsHeapBytes: 600,
      jsHeapDeltaBytes: -400,
      inferredGarbageCollection: true,
      frameIntervalMs: 16,
      droppedWallTimeMs: 4,
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

  it("rejects unbounded capacities", () => {
    expect(() => createPerformanceCollector({ capacity: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      createPerformanceCollector({ timelineCapacity: 1_001 }),
    ).toThrow(RangeError);
  });
});
