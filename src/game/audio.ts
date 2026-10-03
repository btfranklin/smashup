import { getRoundResultCue } from "./audioTransitions";
import { clamp, signedSpeedForCar } from "./math";
import { getPlayerCar } from "./selectors";
import type { Car, CollisionEvent, GameState } from "./types";

type AudioContextLike = AudioContext;

export type EngineAudioMix = {
  active: boolean;
  roughness: number;
  enginePitch: number;
  subPitch: number;
  noiseFrequency: number;
  engineLevel: number;
  rumbleLevel: number;
  skidFrequency: number;
  skidLevel: number;
};

export type CountdownToneDecision = {
  nextIntroCount: number;
  frequency: number | null;
};

export type CrashSoundBurst = {
  collision: CollisionEvent;
  filterFrequency: number;
  level: number;
  thumpFrequency: number;
  burstDuration: number;
};

function createNoiseBuffer(ctx: AudioContextLike): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.75);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function deriveEngineAudioMix(
  state: Pick<GameState, "mode" | "sessionElapsed">,
  player: Car,
): EngineAudioMix {
  const speed = Math.abs(signedSpeedForCar(player));
  const throttle = Math.max(player.controls.forward, player.controls.reverse);
  const active = state.mode === "running" && !player.disabled;
  const health = player.systems.engine;
  const transmission = player.systems.transmission;
  const roughness = clamp(
    (0.78 - health) / 0.4 + player.systems.overheat * 0.4,
    0,
    1,
  );
  const enginePitch = 48 + speed * 0.55 + throttle * 28;
  const healthColor = 0.72 + health * 0.42;
  const wobble =
    Math.sin(state.sessionElapsed * (6 + roughness * 12)) * roughness * 7;
  const pitch = (enginePitch + wobble) * healthColor * player.engineTone;
  const subPitch =
    (enginePitch * 0.48 - roughness * 8) * transmission * player.engineTone;
  const noiseFrequency = 280 + speed * 4.2 + throttle * 180 + roughness * 260;
  const engineLevel = active
    ? clamp(
        0.015 +
          throttle * 0.045 +
          (speed / player.forwardMaxSpeed) * 0.06 +
          roughness * 0.016,
        0,
        0.13,
      )
    : 0;
  const rumbleLevel = active
    ? clamp(
        0.01 +
          throttle * 0.018 +
          (speed / player.forwardMaxSpeed) * 0.02 +
          roughness * 0.012,
        0,
        0.06,
      )
    : 0;
  return {
    active,
    roughness,
    enginePitch: pitch,
    subPitch,
    noiseFrequency,
    engineLevel,
    rumbleLevel,
    skidFrequency: 1200 + player.slipAmount * 18,
    skidLevel:
      active && speed > 35
        ? clamp((player.slipAmount - 12) / 65, 0, 0.07)
        : 0,
  };
}

export function getCountdownToneFrequency(
  mode: GameState["mode"],
  countdown: number,
  lastIntroCount: number,
): CountdownToneDecision {
  if (mode !== "intro") {
    return { nextIntroCount: 0, frequency: null };
  }
  const nextIntroCount = Math.max(0, Math.ceil(countdown));
  if (nextIntroCount > 0 && nextIntroCount !== lastIntroCount) {
    return {
      nextIntroCount,
      frequency: nextIntroCount === 1 ? 880 : 660,
    };
  }
  return { nextIntroCount, frequency: null };
}

export function getCrashSoundBursts(
  collisions: CollisionEvent[],
  cars: Car[],
): CrashSoundBurst[] {
  const carsById = new Map(cars.map((car) => [car.id, car]));
  return [...collisions]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2)
    .map((collision) => {
      const a = carsById.get(collision.aId);
      const b = carsById.get(collision.bId);
      const accumulatedDamage =
        ((a?.body.front ?? 0) +
          (a?.body.rear ?? 0) +
          (a?.body.left ?? 0) +
          (a?.body.right ?? 0) +
          (b?.body.front ?? 0) +
          (b?.body.rear ?? 0) +
          (b?.body.left ?? 0) +
          (b?.body.right ?? 0)) *
        0.5;
      const metallicBias =
        collision.zoneA === "front" || collision.zoneB === "front" ? 1.15 : 0.9;
      return {
        collision,
        filterFrequency: clamp(
          420 +
            collision.severity * 1600 * metallicBias -
            accumulatedDamage * 90,
          220,
          2200,
        ),
        level: clamp(0.035 + collision.severity * 0.18, 0, 0.24),
        thumpFrequency: 90 + collision.severity * 70,
        burstDuration: 0.22 + collision.severity * 0.1,
      };
    });
}

export class AudioManager {
  private ctx: AudioContextLike | null = null;

  private prepareSuspension: Promise<void> | null = null;

  private master: GainNode | null = null;

  private engineGain: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;

  private engineSub: OscillatorNode | null = null;

  private engineNoiseGain: GainNode | null = null;

  private engineNoiseFilter: BiquadFilterNode | null = null;

  private engineNoiseLoop: AudioBufferSourceNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private skidGain: GainNode | null = null;

  private skidFilter: BiquadFilterNode | null = null;

  private crashCooldownTicks = 0;

  private lastMode: GameState["mode"] = "menu";

  private lastIntroCount = 0;

  private voiceCreationCount = 0;

  getVoiceCreationCount(): number {
    return this.voiceCreationCount;
  }

  private async suspendPreparedContext(ctx: AudioContextLike): Promise<void> {
    try {
      await ctx.suspend();
    } catch (error) {
      if (this.ctx === ctx && ctx.state !== "closed") {
        console.error("Unable to suspend a prepared audio context.", error);
      }
    } finally {
      if (this.ctx === ctx) {
        this.prepareSuspension = null;
      }
    }
  }

  private createGraph(suspendWhenRunning: boolean): void {
    if (this.ctx) {
      return;
    }

    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) {
      return;
    }

    const ctx = new AudioCtor();
    try {
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);

      const engineOsc = ctx.createOscillator();
      this.voiceCreationCount += 1;
      engineOsc.type = "sawtooth";
      engineOsc.frequency.value = 70;
      engineOsc.connect(engineGain);
      engineOsc.start();

      const engineSub = ctx.createOscillator();
      this.voiceCreationCount += 1;
      engineSub.type = "triangle";
      engineSub.frequency.value = 36;
      engineSub.connect(engineGain);
      engineSub.start();

      const engineNoiseFilter = ctx.createBiquadFilter();
      engineNoiseFilter.type = "bandpass";
      engineNoiseFilter.frequency.value = 420;
      engineNoiseFilter.Q.value = 0.8;

      const engineNoiseGain = ctx.createGain();
      engineNoiseGain.gain.value = 0;
      engineNoiseFilter.connect(engineNoiseGain);
      engineNoiseGain.connect(master);

      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = "bandpass";
      skidFilter.frequency.value = 1600;
      skidFilter.Q.value = 1.2;

      const skidGain = ctx.createGain();
      skidGain.gain.value = 0;
      skidFilter.connect(skidGain);
      skidGain.connect(master);

      const noiseBuffer = createNoiseBuffer(ctx);
      const noiseLoop = ctx.createBufferSource();
      this.voiceCreationCount += 1;
      noiseLoop.buffer = noiseBuffer;
      noiseLoop.loop = true;
      noiseLoop.connect(engineNoiseFilter);
      noiseLoop.connect(skidFilter);
      noiseLoop.start();

      this.ctx = ctx;
      this.master = master;
      this.engineGain = engineGain;
      this.engineOsc = engineOsc;
      this.engineSub = engineSub;
      this.engineNoiseFilter = engineNoiseFilter;
      this.engineNoiseGain = engineNoiseGain;
      this.skidFilter = skidFilter;
      this.skidGain = skidGain;
      this.noiseBuffer = noiseBuffer;
      this.engineNoiseLoop = noiseLoop;
      if (suspendWhenRunning && ctx.state === "running") {
        this.prepareSuspension = this.suspendPreparedContext(ctx);
      }
    } catch (error) {
      this.voiceCreationCount = 0;
      void ctx.close().catch((closeError: unknown) => {
        console.error("Unable to close a failed audio context.", closeError);
      });
      throw error;
    }
  }

  prepare(): void {
    this.createGraph(true);
  }

  async resume(): Promise<void> {
    this.createGraph(false);
    const ctx = this.ctx;
    await this.prepareSuspension;
    if (
      ctx &&
      ctx === this.ctx &&
      ctx.state !== "running" &&
      ctx.state !== "closed"
    ) {
      await ctx.resume();
    }
  }

  async destroy(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    this.ctx = null;
    this.prepareSuspension = null;
    this.engineOsc?.stop();
    this.engineSub?.stop();
    this.engineNoiseLoop?.stop();
    this.master = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineNoiseGain = null;
    this.engineNoiseFilter = null;
    this.engineNoiseLoop = null;
    this.noiseBuffer = null;
    this.skidGain = null;
    this.skidFilter = null;
    this.crashCooldownTicks = 0;
    this.lastMode = "menu";
    this.lastIntroCount = 0;
    this.voiceCreationCount = 0;

    if (ctx.state !== "closed") {
      await ctx.close();
    }
  }

  update(state: GameState): void {
    if (
      !this.ctx ||
      !this.engineGain ||
      !this.engineOsc ||
      !this.engineSub ||
      !this.engineNoiseGain ||
      !this.engineNoiseFilter ||
      !this.skidGain ||
      !this.skidFilter
    ) {
      return;
    }

    const player = getPlayerCar(state);
    if (!player) {
      return;
    }

    const now = this.ctx.currentTime;
    const finishCue = getRoundResultCue(
      this.lastMode,
      state.mode,
      player.disabled,
    );
    const mix = deriveEngineAudioMix(state, player);
    this.engineOsc.frequency.linearRampToValueAtTime(
      mix.enginePitch,
      now + 0.05,
    );
    this.engineSub.frequency.linearRampToValueAtTime(
      mix.subPitch,
      now + 0.05,
    );
    this.engineNoiseFilter.frequency.linearRampToValueAtTime(
      mix.noiseFrequency,
      now + 0.05,
    );
    this.engineGain.gain.linearRampToValueAtTime(mix.engineLevel, now + 0.06);
    this.engineNoiseGain.gain.linearRampToValueAtTime(
      mix.rumbleLevel,
      now + 0.06,
    );
    this.skidFilter.frequency.linearRampToValueAtTime(
      mix.skidFrequency,
      now + 0.04,
    );
    this.skidGain.gain.linearRampToValueAtTime(mix.skidLevel, now + 0.04);

    this.crashCooldownTicks = Math.max(0, this.crashCooldownTicks - 1);
    if (
      (state.mode === "running" || state.mode === "spectating") &&
      state.recentCollisions.length > 0
    ) {
      this.playCrashSounds(state.recentCollisions, state.cars);
    }
    const countdownTone = getCountdownToneFrequency(
      state.mode,
      state.session.countdown,
      this.lastIntroCount,
    );
    if (countdownTone.frequency) {
      this.playCountdownTone(now, countdownTone.frequency);
    }
    this.lastIntroCount = countdownTone.nextIntroCount;
    if (finishCue) {
      this.engineGain.gain.linearRampToValueAtTime(0, now + 0.05);
      this.engineNoiseGain.gain.linearRampToValueAtTime(0, now + 0.05);
      this.skidGain.gain.linearRampToValueAtTime(0, now + 0.05);
      this.playFinishMelody(now, finishCue);
    }
    this.lastMode = state.mode;
  }

  private playCrashSounds(collisions: CollisionEvent[], cars: Car[]): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) {
      return;
    }

    if (this.crashCooldownTicks > 0) {
      return;
    }
    this.crashCooldownTicks = 3;

    const now = this.ctx.currentTime;
    const bursts = getCrashSoundBursts(collisions, cars);

    for (const burstConfig of bursts) {
      const collision = burstConfig.collision;

      const burst = this.ctx.createBufferSource();
      this.voiceCreationCount += 1;
      burst.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = burstConfig.filterFrequency;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      const level = burstConfig.level;
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + burstConfig.burstDuration,
      );

      burst.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      burst.start(now);
      burst.stop(now + 0.28);

      const thump = this.ctx.createOscillator();
      this.voiceCreationCount += 1;
      const thumpGain = this.ctx.createGain();
      thump.type = "triangle";
      thump.frequency.setValueAtTime(burstConfig.thumpFrequency, now);
      thump.frequency.exponentialRampToValueAtTime(36, now + 0.12);
      thumpGain.gain.setValueAtTime(level * 0.8, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      thump.connect(thumpGain);
      thumpGain.connect(this.master);
      thump.start(now);
      thump.stop(now + 0.16);
    }
  }

  private playFinishMelody(startTime: number, mood: "happy" | "sad"): void {
    if (!this.ctx || !this.master) {
      return;
    }

    const notes =
      mood === "happy"
        ? [523.25, 659.25, 783.99, 1046.5]
        : [392.0, 349.23, 293.66, 220.0];
    const noteSpacing = mood === "happy" ? 0.16 : 0.22;
    const peakGain = mood === "happy" ? 0.045 : 0.038;
    notes.forEach((frequency, index) => {
      const now = startTime + index * noteSpacing;
      const osc = this.ctx!.createOscillator();
      this.voiceCreationCount += 1;
      const gain = this.ctx!.createGain();
      osc.type =
        mood === "happy"
          ? index === notes.length - 1
            ? "triangle"
            : "square"
          : index < 2
            ? "triangle"
            : "sine";
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (mood === "happy" ? 0.18 : 0.28),
      );
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(now);
      osc.stop(now + (mood === "happy" ? 0.2 : 0.3));
    });
  }

  private playCountdownTone(startTime: number, frequency: number): void {
    if (!this.ctx || !this.master) {
      return;
    }
    const osc = this.ctx.createOscillator();
    this.voiceCreationCount += 1;
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.026, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(startTime);
    osc.stop(startTime + 0.14);
  }
}
