/**
 * The player entry: the platform-neutral scheduler and the plan, and nothing
 * that makes a sound.
 *
 * `music_player` is one package for web and React Native now: the concrete
 * synths live elsewhere — `@sudobility/music_synth` (web),
 * `@sudobility/music_synth_rn` (native) and `@sudobility/music_sample_engine`
 * (the RN MP3 fallback) — and this is only the scheduler
 * (`SoundfontPlaybackEngine`) and the score→plan maths. An app composes them:
 *
 *   new SoundfontPlaybackEngine({ backend: createWebSynthBackend(...) })      // web
 *   new SoundfontPlaybackEngine({ backend: createNativeSynthBackend(...) })   // native
 *
 * and exports audio with `renderScoreWith(score, renderSamples(...))`, the
 * renderer coming from the synth package. The scheduler consumes a
 * `SynthBackend` (defined in `@sudobility/music_types`); it never supplies one,
 * so this entry builds no player and knows no soundfont — which is why it is
 * the same code for both platforms and no longer needs a web/rn split.
 */
export * from './singleton.js';
export { MusicPlayer } from './player.js';
export { SoundfontPlaybackEngine } from './playback/soundfont-engine.js';
export { renderEvents } from './shared/render-events.js';
export { renderScoreWith } from './shared/render-score.js';
export type { PlanRenderer } from './shared/render-score.js';
export { playbackPlan, playbackTracks, resolveVoice } from './shared/plan.js';
