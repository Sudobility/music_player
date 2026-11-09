# music_player

> **Git policy — never auto-commit or auto-push.** Leave your work in the working
> tree. Run `git commit`, `git push` or `npm publish` **only when the user explicitly
> asks in that turn.** Stay on the current branch; do not open feature branches.

The **playback scheduler**: the transport (`MusicPlayer`), the soundfont scheduling
engine (`SoundfontPlaybackEngine`), plan building and the bus.

**This package schedules sound; it does not make it.** It takes a `Score`, builds a
plan, and drives a `SynthBackend` (the synth interface, defined in music_types). The
synths are their own packages and this one depends on none of them — an app composes
them: `new SoundfontPlaybackEngine({ backend: createXSynthBackend(...) })`. music_lib
binds this to a store (`bindPlayer`, typed on `IMusicPlayer`). This package knows
nothing about editing, files or the store, and music_editing does not depend on it.

Synths that plug in: `@sudobility/music_synth` (web, libfluidsynth in an AudioWorklet)
· `@sudobility/music_synth_rn` (native, libfluidsynth / TinySoundFont) ·
`@sudobility/music_sample_engine` (RN MP3 fallback — a whole `PlaybackEngine`, not a
backend, and the one package that depends *on* this one).

## Commands

- `bun run verify` — format:check + typecheck + lint + test + build (before any push).
- `bun run test:unit` — vitest (`bun run test:watch` to watch). `bun run build` — `tsc -p tsconfig.esm.json`.

## Structure

- `IMusicPlayer` (the transport interface) lives in **music_types**; `src/singleton.ts`
  holds the player singleton (`initializeMusicPlayer`/`getMusicPlayer`/`resetMusicPlayer`)
  and `src/index.ts` is the root export.
- `src/engine.ts` — the engine contract (`PlaybackEngine`, `PlaybackObserver`,
  `AuditionVoice`). `SoundfontPlaybackEngine` implements it here; so does
  music_sample_engine's engine, which reaches the contract through `/core`.
- `src/player.ts` — `MusicPlayer`, the transport.
- `src/playback/` — the scheduler (`soundfont-engine.ts`: tempo map, lookahead, loop,
  seek, sounding set — consumes a `SynthBackend`) and primitives (`clock.ts`, `governor.ts`).
- `src/shared/` — `plan.ts`, `render-events.ts`, `render-score.ts` (`renderScoreWith`,
  export composition), `bus.ts`, `note-queue`, `sounding-set`, `visual-sync`, `humanize`.
- `src/core.ts` — the **platform-free** entry (interface, singleton, engine contract,
  plan builders). `src/react/` — `usePlaybackReadiness` (the only thing needing React).
  `src/mocks/` — `MockMusicPlayer`. `src/test/fake-synth-backend.ts` — the backend double.
- **One entry for web and RN** (`dist/index.js`): once the synths left, the two platform
  entries became identical and the split collapsed. `/core`, `/react`, `/mocks` remain.
- Pure voicing helpers (`channel-allocator`, mix/limiter, `instrument-gain`) and the
  `SynthBackend`/`ScheduledClick`/`PrepareResult` contract live in **music_types**.

## Package boundaries

`src/contract/no-domain-imports.test.ts` enforces: no music_lib, no music_io, no
vexflow, no runtime dependency, **music_types the only required peer** (React optional,
for `./react`). No synth library is a peer. `src/__single-source.test.ts` and
`src/__one-declaration.test.ts` enforce single-source constants (names read from
music_types at runtime; `Unsubscribe` guarded against duplicate copies).

## Gotchas

- **`IMusicPlayer.load()` takes a `Score`; the engine takes a plan.** This package owns
  `playbackPlan`, so `PlaybackEngine.load()` takes a `PlaybackPlan` and does no score maths.
- **music_lib imports this only through `/core`** — the interface-only half (contract,
  singleton, plan). The root export brings the engine, and a bare root import would put
  the engine in a package whose guard asserts it has none.
- **The player has no caret, deliberately.** `togglePlay`, `seekToMeasure`, `goToStart`,
  `previousMeasure`/`nextMeasure` and loop-from-selection read or write the caret or
  selection (editing state) — they live in music_lib's playback adapter and compose the
  primitives this exposes.
- **`load()` while playing is a mix change and nothing else** — the note queue is kept,
  which the host's edit lock makes safe. A score from outside that path (a generation
  result, an opened snapshot) **must be preceded by `stop()`**.
- **`load()` and `play()` reject; they do not swallow.** The host localizes the message;
  this package carries no copy.
- **The bus is exposed, not wrapped** — `IMusicPlayer.bus` is the real `PlaybackBus`.
  `bus.onPosition` and `IMusicPosition.tick` are not duplicates: the channel is a *change
  signal*, the tick is dead-reckoned forward between reports so the caret moves smoothly.
  Synth load progress is **not** a bus channel (it is React-state-like → `onLoadState`).
- **A four-second horizon means anything that changes the future must take the future
  back.** `seek`/`stop`, a **speed** change (re-seeks: queued notes carry old-speed delays)
  and the **loop** wrap all re-take the horizon. A loop wrap fires the pump tick after the
  end, so `horizonTick` clamps the drain to `endTick - 1`. **Metronome clicks bite**:
  `allSoundOff` speaks only to the synth, so `scheduleClick` hands back a `cancel` the
  engine holds and stop/seek/dispose/metronome-off take back.
- **A note-on at velocity 0 is a note-off.** `clampVelocity` keeps live velocities 1..127;
  `PlaybackNote.velocity` is MIDI 0-127 while `RenderEvent.velocity` (export) is 0..1 — the
  unit trap on either side.
- **`onActiveNotes` fires only on change** (`shared/sounding-set.ts`); the lit set comes
  off the clock (`SoundingSet` answers "what is sounding now"), never off scheduled voices.
- **Audio export is `renderScoreWith(score, renderer)`** (`shared/render-score.ts`):
  platform-free, the renderer injected (each synth's `renderSamples`), so the file is a
  recording of what was heard. This package renders nothing itself.
- **The player owns readiness** (`notReady` → `preparing` → `ready`); `usePlaybackReadiness`
  (`/react`) is how a Play button shows it *and* what starts the bring-up — the first
  component to ask calls `prepare()` once. **`failed` counts as `ready`** (reported through
  `onLoadState`; a retrying Play is all that is left). `prepare()` is the engine's
  idempotent `initialize`, and every backend reports `ready` when up with no score.

The deep synth, sample-pack and export lore that used to live here now lives with the
code: web synth → `music_synth`; native synth → `music_synth_rn`; MP3 sample fallback →
`music_sample_engine`.

## Related projects

`music_types` (model + playhead + `SynthBackend` contract + voicing helpers) ·
`music_synth` · `music_synth_rn` · `music_sample_engine` · `music_codecs` · `music_io` ·
`music_editing` · `music_lib` · `music_app`
