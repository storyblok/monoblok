import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIELD_PLUGINS_CONVENTION_PATH, resolveFieldPluginsSource } from './field-plugins';

// This module resolves a real TypeScript file from disk via jiti, so it needs the
// real filesystem rather than the memfs mock the global test setup installs.
vi.unmock('node:fs');
vi.unmock('node:fs/promises');

let cwd: string;

const SCHEMA_EXPORT = `
export const schema = {
  blocks: {},
  fieldPlugins: { colorPicker: { fieldType: 'storyblok-colorpicker', value: {} } },
};
`;

const RECORD_EXPORT = `
export const fieldPlugins = { colorPicker: { fieldType: 'storyblok-colorpicker', value: {} } };
`;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'sb-field-plugins-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('resolveFieldPluginsSource', () => {
  it('returns none when neither an override nor the convention file exists', async () => {
    expect(await resolveFieldPluginsSource({ cwd })).toEqual({ kind: 'none' });
  });

  it('detects a defineSchema result at the convention path', async () => {
    const target = join(cwd, FIELD_PLUGINS_CONVENTION_PATH);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, SCHEMA_EXPORT, 'utf8');

    const result = await resolveFieldPluginsSource({ cwd });

    expect(result).toEqual({ kind: 'schema', modulePath: target, fieldTypes: ['storyblok-colorpicker'] });
  });

  it('detects a bare fieldPlugins record via an explicit override', async () => {
    const target = join(cwd, 'plugins.ts');
    await writeFile(target, RECORD_EXPORT, 'utf8');

    const result = await resolveFieldPluginsSource({ cwd, override: 'plugins.ts' });

    expect(result).toEqual({ kind: 'record', modulePath: target, fieldTypes: ['storyblok-colorpicker'] });
  });

  it('throws when an explicit override does not exist', async () => {
    await expect(resolveFieldPluginsSource({ cwd, override: 'missing.ts' }))
      .rejects
      .toThrow(/not found/);
  });

  it('throws when an explicit override exports neither supported shape', async () => {
    const target = join(cwd, 'plugins.ts');
    await writeFile(target, 'export const nope = 1;', 'utf8');

    await expect(resolveFieldPluginsSource({ cwd, override: 'plugins.ts' }))
      .rejects
      .toThrow(/fieldPlugins/);
  });

  it('returns none when the convention file exists but exports neither shape', async () => {
    const target = join(cwd, FIELD_PLUGINS_CONVENTION_PATH);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, 'export const schema = { blocks: {} };', 'utf8');

    expect(await resolveFieldPluginsSource({ cwd })).toEqual({ kind: 'none' });
  });
});
