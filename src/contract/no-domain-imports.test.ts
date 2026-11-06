/**
 * music_player makes sound. It must not reach into the domain, nor into the
 * platform package beside it.
 *
 * `music_io`'s own guard records what this costs when it is merely remembered:
 * live playback took a `Score`, the engine then needed tempo maths, tie joining
 * and the GM tables to do anything with it, and by the end the two packages
 * were mutually dependent and neither could be type-checked until the other had
 * published.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = ['@sudobility/music_lib', '@sudobility/music_io', 'vexflow'];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts'))
      found.push(path);
  }
  return found;
}

describe('package boundaries', () => {
  it('imports neither the domain nor the sibling platform package', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      const text = readFileSync(file, 'utf8');
      for (const banned of FORBIDDEN) {
        if (
          text.includes(`from '${banned}`) ||
          text.includes(`from "${banned}`)
        ) {
          offenders.push(`${file}: ${banned}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('takes no runtime dependency, and music_types as its only required peer', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
    expect(Object.keys(pkg.peerDependencies ?? {}).sort()).toEqual([
      '@sudobility/music_types',
      'react',
    ]);
    // No synth library is a peer any more: the concrete synths moved to their
    // own packages (`@sudobility/music_synth`, `music_synth_rn`,
    // `music_sample_engine`), which carry js-synthesizer / react-native-audio-api
    // themselves. This package is only the scheduler. React stays optional:
    // only the `./react` entry (`usePlaybackReadiness`) needs it, and a host
    // that drives playback from outside React must not be made to install it.
    expect(pkg.peerDependenciesMeta['react'].optional).toBe(true);
  });
});
