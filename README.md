# @sudobility/music_player

The **playback scheduler for ScoreSmith**: the transport (`MusicPlayer`), the
soundfont scheduling engine (`SoundfontPlaybackEngine`), plan building and the
playback bus — for both web and React Native.

**This package schedules sound; it does not make it.** It takes a `Score`, builds a
`PlaybackPlan`, and drives a `SynthBackend` (the synth interface, defined in
`@sudobility/music_types`). The concrete synths are separate packages and this one
depends on none of them — an app composes them together. It also knows nothing about
editing, files or the host store.

## Install

This package is published to **GitHub Packages** under the `@sudobility` scope. The
repo's `.npmrc` already points the scope at the GitHub registry:

```
@sudobility:registry=https://npm.pkg.github.com
```

Consumers need the same mapping plus an auth token for the registry. Then:

```sh
bun add @sudobility/music_player
# or: npm install @sudobility/music_player
```

### Peer dependencies

- `@sudobility/music_types` (required) — the model, playhead, `SynthBackend` contract
  and voicing helpers.
- `react` `>=18` (optional) — only needed for the `@sudobility/music_player/react`
  entry (`usePlaybackReadiness`).

A synth backend package is also required at runtime to produce sound (see
[Related packages](#related-packages)); none is a peer dependency of this package.

## Entry points

| Import | Contents |
| --- | --- |
| `@sudobility/music_player` | Root: `MusicPlayer`, `SoundfontPlaybackEngine`, plan builders, `renderScoreWith`, the singleton. |
| `@sudobility/music_player/core` | **Platform-free** half: engine contract, singleton, plan builders, `PlaybackBus`. No engine. Hosts that only *drive* playback import this. |
| `@sudobility/music_player/react` | React binding: `usePlaybackReadiness`. |
| `@sudobility/music_player/mocks` | `MockMusicPlayer` — a no-sound double for consumer tests. |

## Usage

Compose the scheduler with a synth backend (the backend comes from a synth package):

```ts
import { SoundfontPlaybackEngine } from '@sudobility/music_player';
// backend factory comes from a synth package, e.g. @sudobility/music_synth
const engine = new SoundfontPlaybackEngine({ backend: createWebSynthBackend(/* ... */) });
```

Export audio with an injected renderer (also from the synth package), so the file is a
recording of what was heard:

```ts
import { renderScoreWith } from '@sudobility/music_player';
const audio = await renderScoreWith(score, renderSamples(/* ... */)); // { samples, sampleRate }
```

The transport is a singleton — install one at your app's composition root:

```ts
import { initializeMusicPlayer, getMusicPlayer } from '@sudobility/music_player/core';
initializeMusicPlayer(player); // idempotent
const player = getMusicPlayer(); // throws if not yet initialized
```

## Scripts

Uses **bun** as the package manager (`bun.lock`). Available scripts:

| Script | What it does |
| --- | --- |
| `bun run build` | Compile to `dist/` (`tsc -p tsconfig.esm.json`, ESM + `.d.ts`). |
| `bun run clean` | Remove `dist/`. |
| `bun run test:unit` | Run the vitest suite once. |
| `bun run test:watch` | Run vitest in watch mode. |
| `bun run typecheck` | `tsc --noEmit`. |
| `bun run lint` | ESLint over `src`. |
| `bun run format` / `format:check` | Prettier write / check over `src/**/*.ts`. |
| `bun run verify` | `format:check` + `typecheck` + `lint` + `test:unit` + `build` — run before any push. |

There is no runnable application; this is a library. Tests run under the `node`
environment (Web Audio is stubbed per suite, not via jsdom).

## Project layout

- `src/index.ts` — root export (scheduler + plan).
- `src/core.ts` — platform-free entry (engine contract, singleton, plan, bus).
- `src/engine.ts` — the `PlaybackEngine` / `PlaybackObserver` / `AuditionVoice` contract.
- `src/player.ts` — `MusicPlayer`, the transport (implements `IMusicPlayer` from music_types).
- `src/singleton.ts` — the player singleton (`initializeMusicPlayer` / `getMusicPlayer`).
- `src/playback/` — the scheduler (`soundfont-engine.ts`) and primitives (`clock.ts`, `governor.ts`).
- `src/shared/` — `plan.ts`, `render-events.ts`, `render-score.ts`, `bus.ts`, `note-queue`,
  `sounding-set`, `visual-sync`, `humanize`.
- `src/react/` — `usePlaybackReadiness`.
- `src/mocks/` — `MockMusicPlayer`. `src/test/` — the fake synth backend double.
- `src/contract/`, `src/__*.test.ts` — boundary/single-source guard tests.

See [`CLAUDE.md`](./CLAUDE.md) for the package boundaries, architecture rationale and
the scheduling gotchas (horizon/seek/loop, velocity units, readiness).

## Related packages

- `@sudobility/music_types` — model, playhead, `SynthBackend` contract, voicing helpers.
- `@sudobility/music_synth` — web synth (libfluidsynth in an AudioWorklet).
- `@sudobility/music_synth_rn` — native synth (libfluidsynth / TinySoundFont).
- `@sudobility/music_sample_engine` — RN MP3 fallback (a whole `PlaybackEngine`, and the
  one package that depends *on* this one).
- `music_codecs` · `music_io` · `music_editing` · `music_lib` · `music_app`.

## License

BUSL-1.1 © Sudobility
