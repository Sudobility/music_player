/**
 * A `SynthBackend` test double for the scheduler's own tests.
 *
 * `SoundfontPlaybackEngine` only knows the `SynthBackend` interface, so its
 * tests only need something that implements it and records what it was told.
 * They used to build the *real* `WebSynthBackend` around a stub host, which
 * coupled the engine's suite to the web synth; now that the web synth lives in
 * `@sudobility/music_synth`, the engine is tested against this fake instead,
 * and `WebSynthBackend`'s own bring-up rules are tested in that package.
 *
 * It wraps a `host` of plain recorders (the old `stubHost`) and forwards the
 * per-note calls to it, so the existing assertions on `host.programSelect`,
 * `host.noteOn`, … keep working unchanged. The backend-only surface the host
 * never had — `prepare`, `now`, `scheduleClick`, … — is supplied here, with
 * `prepare` injectable so a test can model a synth that is already warm, one
 * that defers (a suspended context, in the real web backend), one whose load is
 * still pending, or one that fails.
 */
import type {
  PlaybackLoadState,
  PrepareResult,
  ScheduledClick,
  SynthBackend,
} from '@sudobility/music_types';

/** One scheduled metronome click, as the fake recorded it. */
export type ClickRecord = { startAt: number; stopAt: number; accent: boolean };

/** The recorders the engine tests assert on — the former `stubHost`. */
export type StubHost = {
  init: (options?: { instanceCount: number }) => Promise<void> | void;
  ensureInstances: (count: number) => Promise<void> | void;
  setChannelPercussion: (
    instance: number,
    channel: number,
    kit?: number
  ) => void;
  programSelect: (instance: number, channel: number, program: number) => void;
  noteOn: (
    instance: number,
    channel: number,
    midi: number,
    velocity: number
  ) => void;
  noteAt: (
    instance: number,
    channel: number,
    midi: number,
    velocity: number,
    delaySeconds: number,
    durationSeconds: number
  ) => void;
  noteOff: (instance: number, channel: number, midi: number) => void;
  controlChange: (
    instance: number,
    channel: number,
    control: number,
    value: number
  ) => void;
  allSoundOff: () => void;
  setInterpolation: (order: number) => void;
  setMasterVolume: (volume: number) => void;
  setTrackCount: (count: number) => void;
  dispose: () => void;
};

export type PrepareOptions = {
  instanceCount: number;
  programs?: { melodic: number[]; percussion: number[] };
  onProgress: (state: PlaybackLoadState) => void;
};

/** How a given test wants `prepare` to behave; it may drive `host.init` itself. */
export type FakePrepare = (
  options: PrepareOptions,
  host: StubHost
) => Promise<PrepareResult>;

/** The default: a warm synth — bring the host up and report ready at once. */
export const readyPrepare: FakePrepare = async (options, host) => {
  await host.init(options);
  return 'ready';
};

export class FakeSynthBackend implements SynthBackend {
  readonly clicks: ClickRecord[] = [];
  /** Overridable per test; defaults to a synth that is already warm. */
  prepareImpl: FakePrepare;
  /** Seconds of output latency the engine will read; a test can exaggerate it. */
  outputLatencySeconds = 0;
  /**
   * Model a web context that stays suspended until a gesture: `prepare` reports
   * `deferred` until `activateAudio` has been called (which `play` and `noteOn`
   * do), then runs for real.
   */
  private readonly deferUntilActivated: boolean;
  private activated = false;
  private readonly clock: () => number;

  constructor(
    readonly host: StubHost,
    opts: {
      now?: () => number;
      prepare?: FakePrepare;
      deferUntilActivated?: boolean;
    } = {}
  ) {
    this.clock = opts.now ?? (() => 0);
    this.prepareImpl = opts.prepare ?? readyPrepare;
    this.deferUntilActivated = opts.deferUntilActivated ?? false;
  }

  activateAudio(): void {
    this.activated = true;
  }

  prepare(options: PrepareOptions): Promise<PrepareResult> {
    if (this.deferUntilActivated && !this.activated) {
      return Promise.resolve('deferred');
    }
    return this.prepareImpl(options, this.host);
  }

  async setPrograms(): Promise<void> {}

  async ensureInstances(count: number): Promise<void> {
    await this.host.ensureInstances(count);
  }

  now(): number {
    return this.clock();
  }

  outputLatency(): number | undefined {
    return this.outputLatencySeconds;
  }

  noteAt(
    instance: number,
    channel: number,
    midi: number,
    velocity: number,
    delaySeconds: number,
    durationSeconds: number
  ): void {
    this.host.noteAt(
      instance,
      channel,
      midi,
      velocity,
      delaySeconds,
      durationSeconds
    );
  }

  noteOn(
    instance: number,
    channel: number,
    midi: number,
    velocity: number
  ): void {
    this.host.noteOn(instance, channel, midi, velocity);
  }

  noteOff(instance: number, channel: number, midi: number): void {
    this.host.noteOff(instance, channel, midi);
  }

  programSelect(instance: number, channel: number, program: number): void {
    this.host.programSelect(instance, channel, program);
  }

  setChannelPercussion(instance: number, channel: number, kit?: number): void {
    this.host.setChannelPercussion(instance, channel, kit);
  }

  controlChange(
    instance: number,
    channel: number,
    control: number,
    value: number
  ): void {
    this.host.controlChange(instance, channel, control, value);
  }

  scheduleClick(atSeconds: number, accent: boolean): ScheduledClick {
    const record: ClickRecord = { startAt: atSeconds, stopAt: 0, accent };
    this.clicks.push(record);
    return {
      endsAt: atSeconds + 0.1,
      cancel: (at: number) => {
        record.stopAt = at;
      },
    };
  }

  allSoundOff(): void {
    this.host.allSoundOff();
  }

  setInterpolation(order: number): void {
    this.host.setInterpolation(order);
  }

  setMasterVolume(volume: number): void {
    this.host.setMasterVolume(volume);
  }

  setTrackCount(count: number): void {
    this.host.setTrackCount(count);
  }

  dispose(): void {
    this.host.dispose();
  }
}
