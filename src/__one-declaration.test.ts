/**
 * The shared playback contracts are declared once — in `@sudobility/music_types`.
 *
 * `Unsubscribe` used to live here (with a second, identical copy in the bus),
 * and `IMusicPlayer`/`PlaybackReadiness` were this package's own. Two identical
 * types agree right up until one is edited, and nothing fails when they part.
 * They now live in `@sudobility/music_types` beside the other playback contracts
 * (`SynthBackend`, `ScheduledClick`), which every implementer imports — so there
 * is nothing of them left in this package to count. This guards against a copy
 * creeping back in.
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

describe('playback contracts are not redeclared here', () => {
  it.each(['Unsubscribe', 'IMusicPlayer', 'PlaybackReadiness', 'PlaybackBus'])(
    'does not re-declare %s (it lives in music_types)',
    name => {
      const pattern = new RegExp(
        `^export\\s+(?:type|interface)\\s+${name}\\b`,
        'm'
      );
      const files = globSync('src/**/*.ts').filter(
        file =>
          !file.includes('.test.') && pattern.test(readFileSync(file, 'utf8'))
      );
      expect(files).toHaveLength(0);
    }
  );
});
