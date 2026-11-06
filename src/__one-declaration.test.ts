/**
 * `Unsubscribe` is declared once.
 *
 * It had a second, identical declaration in the bus beside `types.ts`. Two
 * identical types agree right up until one is edited, and nothing fails when
 * they part, so this counts the declarations.
 *
 * `ScheduledClick` used to be guarded here too — it had a second copy in the
 * web click beside the synth backend's. It now lives in `@sudobility/music_types`
 * (the `SynthBackend` contract moved there, being the one playback type with
 * more than one implementer), so both the backend and the click import it and
 * there is nothing of it left in this package to count.
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

describe('one declaration per type', () => {
  it.each(['Unsubscribe'])('declares %s once', name => {
    const pattern = new RegExp(
      `^export\\s+(?:type|interface)\\s+${name}\\b`,
      'm'
    );
    const files = globSync('src/**/*.ts').filter(
      file =>
        !file.includes('.test.') && pattern.test(readFileSync(file, 'utf8'))
    );
    expect(files).toHaveLength(1);
  });
});
