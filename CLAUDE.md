# music_player

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push` or `npm publish` **only when the user explicitly asks in
> that turn**. Approval for an earlier change does not carry forward, and finishing a
> task is not permission to commit it.

The **playback scheduler**: the transport, the soundfont scheduling engine
(`SoundfontPlaybackEngine`), plan building, and the bus. One of the Moosiac
family — see `music_app/docs/architecture.md`.

**This package schedules sound; it does not make it.** It takes a `Score`,
builds a plan, and drives a `SynthBackend` — the interface a concrete synth
implements, defined in `music_types`. The synths are their own packages and
this one depends on none of them:

- `@sudobility/music_synth` — the web synth (libfluidsynth in an `AudioWorklet`).
- `@sudobility/music_synth_rn` — the native synth (libfluidsynth / TinySoundFont).
- `@sudobility/music_sample_engine` — the RN MP3 sample fallback (a whole
  `PlaybackEngine`, not a backend; the one package that depends *on* this one).

An app composes them: `new SoundfontPlaybackEngine({ backend: createXSynthBackend(...) })`.
`music_io` moves bytes, `music_codecs` reads and writes score formats,
`music_editing` edits, and `music_lib` binds the two (`bindPlayer`, typed on
this package's `IMusicPlayer`). This package knows nothing about editing, files
or the store — and music_editing does not depend on it either.

## Structure

- `src/types.ts` — `IMusicPlayer`, the transport interface.
- `src/engine.ts` — the engine contract (`PlaybackEngine`, `PlaybackObserver`,
  `AuditionVoice`). `SoundfontPlaybackEngine` implements it here; so does
  `music_sample_engine`'s `RNSamplePlaybackEngine`, which reaches the contract
  through `/core`.
- `src/player.ts` — `MusicPlayer`, the transport.
- `src/playback/` — the scheduler (`soundfont-engine.ts`: tempo map, lookahead,
  loop, seek, sounding set — it consumes a `SynthBackend`, the synth lives
  elsewhere) and its primitives (`clock.ts`, `governor.ts`).
- `src/shared/` — `plan.ts`, `render-events.ts`, `render-score.ts`
  (`renderScoreWith`, the export composition), `bus.ts`, `note-queue`,
  `sounding-set`, `visual-sync`, `pump-window`, `midi` — the scheduling and
  compose primitives. The pure voicing helpers (`channel-allocator`, mix/limiter,
  `instrument-gain`) and the `SynthBackend`/`ScheduledClick`/`PrepareResult`
  contract moved to `music_types`, which both this package and the synth
  packages depend on.
- `src/core.ts` — the **platform-free** entry: interface, singleton, engine
  contract, plan builders.
- `src/react/` — `usePlaybackReadiness` (the only thing needing React).
- `src/mocks/` — `MockMusicPlayer`, for downstream tests.
- `src/test/fake-synth-backend.ts` — a `SynthBackend` double the engine tests
  drive, now that the real synths live in other packages.

There is **one entry for web and React Native** (`dist/index.js`): once the
synths left, the two platform entries became identical, so the web/rn split
collapsed. `/core`, `/react` and `/mocks` remain.

## Package boundaries

`src/contract/no-domain-imports.test.ts` enforces: no `music_lib`, no
`music_io`, no `vexflow`, no runtime dependency, and **`music_types` as the only
required peer** (React is an optional peer, for the `./react` entry alone). No
synth library is a peer any more — `js-synthesizer` and `react-native-audio-api`
moved out with the synths that use them.

## Gotchas

- **One fact, one declaration — and `src/__single-source.test.ts` enforces it.** A constant restated in a second package agrees with the first right up until one of them is edited, and nothing fails when they part: the build is clean, the types match, and the only symptom is a wrong sound or a picker quietly missing an entry. The guard reads the list of names **from music_types at runtime** rather than restating it; its `ALLOWED` list is empty on purpose. **A closed vocabulary is declared as an array and the type read off it** (`export const DYNAMICS = [...] as const; export type Dynamic = (typeof DYNAMICS)[number];`). **A label or option list keyed by the vocabulary is a `Record<T, ...>`, never a parallel array** — a record fails to compile when a member is added. Test fixtures follow the same rule: the score fixtures live once, in `@sudobility/music_types/test`.

- **`ScheduledClick` is declared once — now in `music_types`.** It, with
  `PrepareResult` and the `SynthBackend` contract, moved to music_types so the
  scheduler and every synth share one declaration. `src/__one-declaration.test.ts`
  still guards `Unsubscribe` (the bus and `types.ts` had identical copies).

- **`IMusicPlayer.load()` takes a `Score`; the engine still takes a plan.** This
  package owns `playbackPlan`, so making the caller build one first would be a
  two-step dance whose second step is here. Underneath, `PlaybackEngine.load()`
  takes a `PlaybackPlan` and does no score maths.
- **The player has no caret, and that is deliberate.** `togglePlay`,
  `seekToMeasure`, `goToStart`, `previousMeasure`, `nextMeasure` and
  loop-from-selection are **not** here: all read or write the caret or the
  selection, which is editing state. They live in music_lib's playback adapter
  and compose the primitives this exposes.
- **`music_lib` imports this package only through `/core`.** The root export
  brings `MusicPlayer` and `SoundfontPlaybackEngine`; `/core` is the
  interface-only half (contract, singleton, plan). A bare root import from
  music_lib would put the engine in a package whose guard asserts it has none.
- **The plan model stays in `music_types`; the engine contract lives here.**
  `PlaybackPlan` composes `PerformanceTimeline`, which `performanceTimeline()`
  in music_types produces, so the whole plan cluster is anchored there. The
  `PlaybackEngine` contract stays here because both implementers reach it from
  here (music_sample_engine via `/core`); the `SynthBackend` contract, with more
  than one home across packages, is in music_types.
- **`load()` while playing is a mix change and nothing else.** The note queue is
  kept. The host's edit lock makes that safe: while the transport runs, the only
  score change that can reach here is a mix change. A score arriving from outside
  that path — a generation result, an opened snapshot — **must be preceded by
  `stop()`**.
- **`load()` and `play()` reject; they do not swallow.** The host translates; the
  message a user sees is localized and this package carries no copy.
- **The bus is exposed, not wrapped.** `IMusicPlayer.bus` is the real
  `PlaybackBus`, so a host binds React to the same object the engine publishes
  into.
- **`bus.onPosition` and `IMusicPosition.tick` are not duplicates.** The channel
  is a *change signal*; the authoritative value is dead-reckoned forward between
  reports so the caret moves smoothly.
- **Synth load progress is not a bus channel.** It reports per percent and
  behaves like ordinary React state, so it goes to the host's store via
  `onLoadState`.
- **A four-second horizon means anything that changes the future has to take the
  future back.** The scheduler (`soundfont-engine.ts`) tops up a rolling horizon
  of self-releasing notes; `seek`/`stop`, a **speed** change and the **loop**
  wrap all re-take it. A speed change re-anchors the caret while queued notes
  carry delays at the old speed, so `setTempoMultiplier` re-seeks. A loop wrap
  happens on the pump tick *after* the end, so `horizonTick` clamps the drain to
  `endTick - 1`. **Metronome clicks are the case that bites**: `allSoundOff`
  speaks only to the synth, so a scheduled click is unreachable from there —
  `scheduleClick` hands back a `cancel`, the engine holds what is pending, and
  stop/seek/dispose/metronome-off take it back. (How a click is *made* — a tuned
  oscillator on web, a percussion note natively — is the backend's; the engine
  only schedules and cancels it.)
- **A note-on at velocity 0 is a note-off.** `clampVelocity` in
  `soundfont-engine.ts` keeps live velocities in 1..127; `PlaybackNote.velocity`
  is MIDI 0-127 while `RenderEvent.velocity` (export) is 0..1 — the unit trap on
  either side.
- **`onActiveNotes` fires only on change** (`shared/sounding-set.ts`). It used to
  be a fresh array every pump tick, waking notation colour and the keyboard
  twenty times a second through a held chord. The lit set comes off the clock
  (`SoundingSet` answers "what is sounding *now*"), never off the scheduled
  voices.
- **Audio export is `renderScoreWith(score, renderer)`** (`shared/render-score.ts`):
  platform-free, the renderer injected. `renderEvents` builds the plan; the
  renderer (each synth package's `renderSamples`) voices it, so the file is a
  recording of what was heard. This package renders nothing itself.
- **The player owns readiness (`notReady` → `preparing` → `ready`), and
  `usePlaybackReadiness` (`@sudobility/music_player/react`) is how a Play button
  shows it — and what starts the bring-up.** The first component to ask starts
  it: the hook reads `readiness`, calls `prepare()` once where it is `notReady`,
  and answers only `preparing` or `ready`. **`failed` counts as `ready`**: the
  failure is reported through `onLoadState` and a Play that retries is the one
  thing left to offer. `prepare()` is the engine's idempotent, retryable
  `initialize`, and **every backend's `prepare` reports `ready` when it is up
  with no score**. React is an optional peer, used by `./react` alone.

## The synths moved out — where their gotchas went

The deep synth, pack and export lore that used to live here now lives with the
code:

- **Web synth** (libfluidsynth in an `AudioWorklet`, js-synthesizer, the synth
  host, polyphony/channel/soundfont-loader specifics, the Vite
  dep-pre-bundle exclusion) → **`@sudobility/music_synth`**.
- **Native synth** (`NativeSynthBackend`, the libfluidsynth build with
  libsndfile for SF3, Oboe, the DerivedData rebuild trap, the Windows
  TinySoundFont/WASAPI module) → **`@sudobility/music_synth_rn`**.
- **MP3 sample fallback** (the FluidR3 packs, pack-name rules, rendered drum
  kits, the measured expression table, the sustain loop, the offline renderer,
  the export limiter, the font-hash pinning) → **`@sudobility/music_sample_engine`**.

## Related Projects

- `music_types` — the model, the score domain, the playhead, and the
  `SynthBackend` contract + voicing helpers (`@sudobility/music_types`)
- `music_synth` · `music_synth_rn` · `music_sample_engine` — the synths this
  scheduler drives
- `music_codecs` — score file formats
- `music_io` — files, audio encoding, XML, MIDI input
- `music_editing` — editing; depends on neither this package nor music_codecs
- `music_lib` — binds a store to this through `bindPlayer` and its playback adapter
- `music_app` — the web UI

## Git Workflow

- Do not use feature branches for code changes. Always stay on the current branch.
