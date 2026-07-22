import { existsSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { legacyInterop } from './index';

// Unlike index.test.ts (which mocks `node:fs`/`node:module`), this suite runs a
// real Vite build so a bundler behaviour change (e.g. in Rolldown's CJS/ESM
// interop) would actually be caught.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const fixturesDir = join(repoRoot, 'test', 'fixtures');
const legacyLibSource = join(fixturesDir, 'legacy-lib');
const legacyLibLink = join(repoRoot, 'node_modules', 'legacy-lib');

describe('legacyInterop (real Vite build)', () => {
  beforeAll(() => {
    // require.resolve('legacy-lib/package.json') needs the fixture reachable
    // via Node module resolution, so link it into node_modules for the test.
    if (!existsSync(legacyLibLink)) {
      symlinkSync(legacyLibSource, legacyLibLink, 'dir');
    }
  });

  afterAll(() => {
    if (existsSync(legacyLibLink)) {
      unlinkSync(legacyLibLink);
    }
  });

  it('bundles a real CJS subpath import into a working ESM default export', async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [legacyInterop({ libs: ['legacy-lib'] })],
      build: {
        write: false,
        lib: {
          entry: join(fixturesDir, 'entry.js'),
          formats: ['es'],
          fileName: () => 'entry.mjs',
        },
      },
    });
    const output = Array.isArray(result) ? result : [result];
    const chunk = output
      .flatMap((r) => ('output' in r ? r.output : []))
      .find((asset): asset is Extract<typeof asset, { type: 'chunk' }> => asset.type === 'chunk');

    expect(chunk).toBeDefined();

    if (!chunk) {
      throw new Error('Expected the build to produce an output chunk');
    }

    // Rolldown minifies the wrapper's variable names, so assert on the absence
    // of leftover CJS syntax rather than on the (unstable) generated names.
    expect(chunk.code).not.toContain('require(');

    const tmpDir = mkdtempSync(join(tmpdir(), 'vite-legacy-interop-'));
    const tmpFile = join(tmpDir, 'entry.mjs');

    writeFileSync(tmpFile, chunk.code);

    try {
      const mod = (await import(pathToFileURL(tmpFile).href)) as { default: () => string };

      expect(mod.default()).toBe('Button rendered');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
