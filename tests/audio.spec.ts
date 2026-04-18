// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

describe("audio model and manager", () => {
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
      { mode: "running", elapsed: 3.4 },
      player,
    );
    const idleMix = deriveEngineAudioMix({ mode: "menu", elapsed: 3.4 }, player);

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

  it("starts audio only once and resumes a suspended context", async () => {
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
    await manager.ensureStarted();
    await manager.ensureStarted();

    const ctx = getLatestAudioContext();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(ctx.resumeCalls).toBe(1);
  });

  it("tolerates update before initialization", () => {
    const manager = new AudioManager();
    expect(() => manager.update(createRunningState())).not.toThrow();
  });

  it("fires the finish melody exactly once for the round-results transition", async () => {
    const manager = new AudioManager();
    await manager.ensureStarted();

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

  it("only plays countdown tones when the intro count changes", async () => {
    const manager = new AudioManager();
    await manager.ensureStarted();
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

  it("respects crash cooldowns between updates", async () => {
    const manager = new AudioManager();
    await manager.ensureStarted();
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

    manager.update(state);
    expect(ctx.bufferSources.length).toBe(afterFirstCrash);

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
