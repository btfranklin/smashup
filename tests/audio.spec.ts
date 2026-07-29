// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioManager,
  deriveEngineAudioMix,
  getCountdownToneFrequency,
  getCrashSoundBursts,
} from "../src/game/audio";
import { createCarFixture, createCollisionFixture, createRunningState, getPlayerFixture } from "./helpers/fixtures";
import {
  FakeAudioContext,
  getLatestAudioContext,
} from "./helpers/audio-stubs";

describe("audio derivation and fake-graph orchestration", () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
  });

  afterEach(() => {
    delete (window as Window & { AudioContext?: typeof AudioContext }).AudioContext;
    delete (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  });

  it("derives engine, rumble, and skid mixes from player state", () => {
    const player = createCarFixture({
      isPlayer: true,
      controls: { steer: 0, forward: 1, reverse: 0 },
      vx: 120,
      slipAmount: 44,
      systems: {
        engine: 0.42,
        radiator: 0.4,
        transmission: 0.7,
        steering: 0.7,
        overheat: 0.5,
      },
    });

    const runningMix = deriveEngineAudioMix(
      { mode: "running", sessionElapsed: 3.4 },
      player,
    );
    const idleMix = deriveEngineAudioMix(
      { mode: "menu", sessionElapsed: 3.4 },
      player,
    );

    expect(runningMix.engineLevel).toBeGreaterThan(0);
    expect(runningMix.rumbleLevel).toBeGreaterThan(0);
    expect(runningMix.skidLevel).toBeGreaterThan(0);
    expect(runningMix.noiseFrequency).toBeGreaterThan(280);
    expect(idleMix.engineLevel).toBe(0);
    expect(idleMix.rumbleLevel).toBe(0);
  });

  it("derives countdown tones from the visible intro count rather than every frame", () => {
    const idle = getCountdownToneFrequency("menu", 3, 0);
    const opening = getCountdownToneFrequency("intro", 3.2, 0);
    const unchanged = getCountdownToneFrequency(
      "intro",
      3.1,
      opening.nextIntroCount,
    );
    const finalBeat = getCountdownToneFrequency("intro", 1, 2);

    expect(idle).toEqual({
      nextIntroCount: 0,
      frequency: null,
    });
    expect(opening.frequency).toBe(660);
    expect(opening.nextIntroCount).toBeGreaterThan(0);
    expect(unchanged.frequency).toBeNull();
    expect(unchanged.nextIntroCount).toBe(opening.nextIntroCount);
    expect(finalBeat).toEqual({
      nextIntroCount: 1,
      frequency: 880,
    });
  });

  it("selects the strongest crash bursts and derives their voice parameters", () => {
    const cars = [
      createCarFixture({ id: 1, body: { front: 0.2, rear: 0.1, left: 0, right: 0 } }),
      createCarFixture({ id: 2, body: { front: 0.1, rear: 0.4, left: 0, right: 0 } }),
      createCarFixture({ id: 3 }),
    ];
    const bursts = getCrashSoundBursts(
      [
        createCollisionFixture({ aId: 1, bId: 2, severity: 0.9 }),
        createCollisionFixture({ aId: 1, bId: 3, severity: 0.7 }),
        createCollisionFixture({ aId: 2, bId: 3, severity: 0.2 }),
      ],
      cars,
    );

    expect(bursts).toHaveLength(2);
    expect(bursts[0].collision.severity).toBeGreaterThanOrEqual(
      bursts[1].collision.severity,
    );
    expect(bursts[0].filterFrequency).toBeGreaterThan(220);
    expect(bursts[0].level).toBeGreaterThan(0.03);
  });

  it("prepares one suspended graph before resuming it once", async () => {
    class SuspendedAudioContext extends FakeAudioContext {
      constructor() {
        super();
        this.state = "suspended";
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: SuspendedAudioContext,
    });

    const manager = new AudioManager();
    expect(manager.getVoiceCreationCount()).toBe(0);
    manager.prepare();
    manager.prepare();

    const ctx = getLatestAudioContext();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(manager.getVoiceCreationCount()).toBe(3);
    expect(ctx.resumeCalls).toBe(0);
    expect(manager.getVoiceCreationCount()).toBe(3);

    await manager.resume();
    await manager.resume();
    expect(ctx.resumeCalls).toBe(1);
  });

  it("suspends an idle-prepared running graph before gesture resume", async () => {
    const manager = new AudioManager();
    manager.prepare();
    const ctx = getLatestAudioContext();

    await vi.waitFor(() => expect(ctx.state).toBe("suspended"));
    expect(ctx.suspendCalls).toBe(1);
    expect(ctx.resumeCalls).toBe(0);

    await manager.resume();
    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe("running");
  });

  it("constructs a running graph on gesture fallback without a suspend cycle", async () => {
    const manager = new AudioManager();

    await manager.resume();

    const ctx = getLatestAudioContext();
    expect(ctx.suspendCalls).toBe(0);
    expect(ctx.resumeCalls).toBe(0);
    expect(ctx.state).toBe("running");
  });

  it("tolerates browsers without a Web Audio constructor", async () => {
    delete (window as Window & { AudioContext?: typeof AudioContext }).AudioContext;
    const manager = new AudioManager();

    expect(() => manager.prepare()).not.toThrow();
    await expect(manager.resume()).resolves.toBeUndefined();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("closes a partially constructed graph when preparation fails", async () => {
    class FailingAudioContext extends FakeAudioContext {
      override createGain(): GainNode {
        throw new Error("Graph construction failed.");
      }
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FailingAudioContext,
    });
    const manager = new AudioManager();

    expect(() => manager.prepare()).toThrow("Graph construction failed.");
    const ctx = getLatestAudioContext();
    await vi.waitFor(() => expect(ctx.closeCalls).toBe(1));
  });

  it("reports a rejected close while unwinding failed preparation", async () => {
    const closeError = new Error("Context close failed.");
    class UnclosableAudioContext extends FakeAudioContext {
      override createGain(): GainNode {
        throw new Error("Graph construction failed.");
      }

      override async close(): Promise<void> {
        this.closeCalls += 1;
        throw closeError;
      }
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: UnclosableAudioContext,
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const manager = new AudioManager();

    expect(() => manager.prepare()).toThrow("Graph construction failed.");
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Unable to close a failed audio context.",
        closeError,
      );
    });
    consoleError.mockRestore();
  });

  it("stops the persistent fake graph and closes its context on destroy", async () => {
    const manager = new AudioManager();
    await manager.resume();
    const ctx = getLatestAudioContext();

    await manager.destroy();
    await manager.destroy();

    expect(manager.getVoiceCreationCount()).toBe(0);
    expect(ctx.oscillators.every((oscillator) => oscillator.stoppedAt.length === 1)).toBe(
      true,
    );
    expect(ctx.bufferSources[0]?.stoppedAt).toHaveLength(1);
    expect(ctx.closeCalls).toBe(1);
    expect(ctx.state).toBe("closed");
  });

  it("tolerates update before initialization", () => {
    const manager = new AudioManager();
    expect(() => manager.update(createRunningState())).not.toThrow();
  });

  it("schedules one finish melody for a single transition", async () => {
    const manager = new AudioManager();
    await manager.resume();

    const running = createRunningState();
    const roundResults = createRunningState();
    roundResults.mode = "round_results";

    manager.update(running);
    manager.update(roundResults);
    const ctx = getLatestAudioContext();
    const afterFirstFinish = ctx.oscillators.length;
    manager.update(roundResults);

    expect(afterFirstFinish).toBeGreaterThan(2);
    expect(ctx.oscillators.length).toBe(afterFirstFinish);
  });

  it("does not schedule duplicate countdown voices", async () => {
    const manager = new AudioManager();
    await manager.resume();
    const state = createRunningState();
    state.mode = "intro";
    state.session.countdown = 3.2;

    manager.update(state);
    const ctx = getLatestAudioContext();
    const afterFirstTone = ctx.oscillators.length;

    state.session.countdown = 3.1;
    manager.update(state);
    expect(ctx.oscillators.length).toBe(afterFirstTone);

    state.session.countdown = 1;
    manager.update(state);
    expect(ctx.oscillators.length).toBeGreaterThan(afterFirstTone);
  });

  it("throttles crash-burst scheduling", async () => {
    const manager = new AudioManager();
    await manager.resume();
    const state = createRunningState();
    const player = getPlayerFixture(state);
    const rival = createCarFixture({ id: 999, x: player.x + 10, y: player.y });
    state.cars.push(rival);
    state.recentCollisions = [
      createCollisionFixture({ aId: player.id, bId: rival.id, severity: 0.9 }),
    ];

    manager.update(state);
    const ctx = getLatestAudioContext();
    const afterFirstCrash = ctx.bufferSources.length;
    const voicesAfterFirstCrash = manager.getVoiceCreationCount();
    expect(voicesAfterFirstCrash).toBeGreaterThan(3);

    manager.update(state);
    expect(ctx.bufferSources.length).toBe(afterFirstCrash);
    expect(manager.getVoiceCreationCount()).toBe(voicesAfterFirstCrash);

    state.recentCollisions = [];
    manager.update(state);
    manager.update(state);
    manager.update(state);
    state.recentCollisions = [
      createCollisionFixture({ aId: player.id, bId: rival.id, severity: 0.9 }),
    ];
    manager.update(state);

    expect(ctx.bufferSources.length).toBeGreaterThan(afterFirstCrash);
  });
});
