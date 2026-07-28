export class FakeAudioParam {
  value: number;

  events: Array<{ type: string; value: number; time: number }> = [];

  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "linear", value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "exponential", value, time });
  }
}

class FakeAudioNode {
  connections: unknown[] = [];

  connect(target: unknown) {
    this.connections.push(target);
    return target;
  }
}

export class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam(1);
}

export class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = "sine";

  frequency = new FakeAudioParam(440);

  startedAt: number[] = [];

  stoppedAt: number[] = [];

  start(time?: number) {
    this.startedAt.push(time ?? 0);
  }

  stop(time?: number) {
    this.stoppedAt.push(time ?? 0);
  }
}

export class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = "lowpass";

  frequency = new FakeAudioParam(350);

  Q = new FakeAudioParam(1);
}

export class FakeAudioBuffer {
  readonly channelData: Float32Array;

  constructor(
    public readonly channels: number,
    public readonly length: number,
    public readonly sampleRate: number,
  ) {
    this.channelData = new Float32Array(length);
  }

  getChannelData() {
    return this.channelData;
  }
}

export class FakeBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null;

  loop = false;

  startedAt: number[] = [];

  stoppedAt: number[] = [];

  start(time?: number) {
    this.startedAt.push(time ?? 0);
  }

  stop(time?: number) {
    this.stoppedAt.push(time ?? 0);
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  sampleRate = 48_000;

  currentTime = 0;

  state: AudioContextState = "running";

  destination = {};

  gains: FakeGainNode[] = [];

  oscillators: FakeOscillatorNode[] = [];

  filters: FakeBiquadFilterNode[] = [];

  buffers: FakeAudioBuffer[] = [];

  bufferSources: FakeBufferSourceNode[] = [];

  resumeCalls = 0;

  suspendCalls = 0;

  closeCalls = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  createBiquadFilter() {
    const filter = new FakeBiquadFilterNode();
    this.filters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeAudioBuffer(channels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer as unknown as AudioBuffer;
  }

  createBufferSource() {
    const source = new FakeBufferSourceNode();
    this.bufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  async resume() {
    this.resumeCalls += 1;
    this.state = "running";
  }

  async suspend() {
    this.suspendCalls += 1;
    this.state = "suspended";
  }

  async close() {
    this.closeCalls += 1;
    this.state = "closed";
  }
}

export function getLatestAudioContext(): FakeAudioContext {
  const latest = FakeAudioContext.instances.at(-1);
  if (!latest) {
    throw new Error("No fake audio context instances were created.");
  }
  return latest;
}
