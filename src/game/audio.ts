import { clamp, signedSpeedForCar } from "./math";
import { getPlayerCar } from "./selectors";
import type { Car, CollisionEvent, GameState } from "./types";

type AudioContextLike = AudioContext;

function createNoiseBuffer(ctx: AudioContextLike): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.75);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class AudioManager {
  private ctx: AudioContextLike | null = null;

  private master: GainNode | null = null;

  private engineGain: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;

  private engineSub: OscillatorNode | null = null;

  private engineNoiseGain: GainNode | null = null;

  private engineNoiseFilter: BiquadFilterNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private skidGain: GainNode | null = null;

  private skidFilter: BiquadFilterNode | null = null;

  private crashCooldownTicks = 0;

  private lastMode: GameState["mode"] = "menu";

  private lastIntroCount = 0;

  async ensureStarted(): Promise<void> {
    const AudioCtor = (window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtor) {
      return;
    }

    if (!this.ctx) {
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.master);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 70;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc.start();

      this.engineSub = this.ctx.createOscillator();
      this.engineSub.type = "triangle";
      this.engineSub.frequency.value = 36;
      this.engineSub.connect(this.engineGain);
      this.engineSub.start();

      this.engineNoiseFilter = this.ctx.createBiquadFilter();
      this.engineNoiseFilter.type = "bandpass";
      this.engineNoiseFilter.frequency.value = 420;
      this.engineNoiseFilter.Q.value = 0.8;

      this.engineNoiseGain = this.ctx.createGain();
      this.engineNoiseGain.gain.value = 0;
      this.engineNoiseFilter.connect(this.engineNoiseGain);
      this.engineNoiseGain.connect(this.master);

      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = "bandpass";
      this.skidFilter.frequency.value = 1600;
      this.skidFilter.Q.value = 1.2;

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;
      this.skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.master);

      this.noiseBuffer = createNoiseBuffer(this.ctx);
      const noiseLoop = this.ctx.createBufferSource();
      noiseLoop.buffer = this.noiseBuffer;
      noiseLoop.loop = true;
      noiseLoop.connect(this.engineNoiseFilter);
      noiseLoop.connect(this.skidFilter);
      noiseLoop.start();
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  update(state: GameState): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineSub || !this.engineNoiseGain || !this.engineNoiseFilter || !this.skidGain || !this.skidFilter) {
      return;
    }

    const player = getPlayerCar(state);
    if (!player) {
      return;
    }

    const speed = Math.abs(signedSpeedForCar(player));
    const throttle = Math.max(player.controls.forward, player.controls.reverse);
    const active = state.mode === "running" && !player.disabled;
    const health = player.systems.engine;
    const transmission = player.systems.transmission;
    const now = this.ctx.currentTime;
    const finishedThisFrame = this.lastMode !== "finished" && state.mode === "finished";
    const roughness = clamp((0.78 - health) / 0.4 + player.systems.overheat * 0.4, 0, 1);

    const enginePitch = 48 + speed * 0.55 + throttle * 28;
    const healthColor = 0.72 + health * 0.42;
    const wobble = Math.sin(state.elapsed * (6 + roughness * 12)) * roughness * 7;
    this.engineOsc.frequency.linearRampToValueAtTime((enginePitch + wobble) * healthColor * player.engineTone, now + 0.05);
    this.engineSub.frequency.linearRampToValueAtTime((enginePitch * 0.48 - roughness * 8) * transmission * player.engineTone, now + 0.05);
    this.engineNoiseFilter.frequency.linearRampToValueAtTime(
      280 + speed * 4.2 + throttle * 180 + roughness * 260,
      now + 0.05,
    );

    const engineLevel = active
      ? clamp(0.015 + throttle * 0.045 + speed / player.forwardMaxSpeed * 0.06 + roughness * 0.016, 0, 0.13)
      : 0;
    const rumbleLevel = active
      ? clamp(0.01 + throttle * 0.018 + speed / player.forwardMaxSpeed * 0.02 + roughness * 0.012, 0, 0.06)
      : 0;
    this.engineGain.gain.linearRampToValueAtTime(engineLevel, now + 0.06);
    this.engineNoiseGain.gain.linearRampToValueAtTime(rumbleLevel, now + 0.06);

    const skidLevel =
      active && speed > 35
        ? clamp((player.slipAmount - 12) / 65, 0, 0.07)
        : 0;
    this.skidFilter.frequency.linearRampToValueAtTime(1200 + player.slipAmount * 18, now + 0.04);
    this.skidGain.gain.linearRampToValueAtTime(skidLevel, now + 0.04);

    this.crashCooldownTicks = Math.max(0, this.crashCooldownTicks - 1);
    if (state.mode === "running" && state.recentCollisions.length > 0) {
      this.playCrashSounds(state.recentCollisions, state.cars);
    }
    if (state.mode === "intro") {
      const nextCount = Math.max(0, Math.ceil(state.session.countdown));
      if (nextCount > 0 && nextCount !== this.lastIntroCount) {
        this.playCountdownTone(now, nextCount === 1 ? 880 : 660);
      }
      this.lastIntroCount = nextCount;
    } else {
      this.lastIntroCount = 0;
    }
    if (finishedThisFrame) {
      this.engineGain.gain.linearRampToValueAtTime(0, now + 0.05);
      this.engineNoiseGain.gain.linearRampToValueAtTime(0, now + 0.05);
      this.skidGain.gain.linearRampToValueAtTime(0, now + 0.05);
      this.playFinishMelody(now, player.disabled ? "sad" : "happy");
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

    const carsById = new Map(cars.map((car) => [car.id, car]));
    const strongest = [...collisions].sort((a, b) => b.severity - a.severity).slice(0, 2);

    for (const collision of strongest) {
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
          (b?.body.right ?? 0)) * 0.5;
      const metallicBias =
        collision.zoneA === "front" || collision.zoneB === "front" ? 1.15 : 0.9;

      const burst = this.ctx.createBufferSource();
      burst.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = clamp(420 + collision.severity * 1600 * metallicBias - accumulatedDamage * 90, 220, 2200);
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      const level = clamp(0.035 + collision.severity * 0.18, 0, 0.24);
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22 + collision.severity * 0.1);

      burst.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      burst.start(now);
      burst.stop(now + 0.28);

      const thump = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thump.type = "triangle";
      thump.frequency.setValueAtTime(90 + collision.severity * 70, now);
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
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (mood === "happy" ? 0.18 : 0.28));
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
