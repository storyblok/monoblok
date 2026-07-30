import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression test for https://github.com/storyblok/monoblok/issues/437:
// "type":"module" caused CJS/UMD dist files to be misidentified as ESM,
// breaking require() callers (UMD silently returned an empty object {}).
//
// Runs post-build (nx task graph ensures build → test order).
// Reads export paths from package.json so the test stays correct after
// a rename from .js → .cjs or any future restructure.

const req = createRequire(import.meta.url);
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

const cjsEntry = resolve(pkgRoot, pkg.exports['.'].require.default);
const esmEntry = resolve(pkgRoot, pkg.exports['.'].import.default);

describe('module format: require() (CJS)', () => {
  it('should load without throwing', () => {
    expect(() => req(cjsEntry)).not.toThrow();
  });

  it('should export storyblokInit as a function', () => {
    const mod = req(cjsEntry);
    expect(typeof mod.storyblokInit).toBe('function');
  });

  it('should export apiPlugin as a function', () => {
    const mod = req(cjsEntry);
    expect(typeof mod.apiPlugin).toBe('function');
  });
});

describe('module format: import() (ESM)', () => {
  it('should load without throwing', async () => {
    await expect(import(esmEntry)).resolves.toBeDefined();
  });

  it('should export storyblokInit as a function', async () => {
    const mod = await import(esmEntry);
    expect(typeof mod.storyblokInit).toBe('function');
  });
});
