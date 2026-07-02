import { afterEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { join } from 'pathe';

import { writeLocalComponents } from './write-local-components';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import type { DiffResult, SchemaData } from '../types';

const SPACE = '12345';

const stripDriveLetter = (p: string) => p.replace(/^[a-z]:/i, '');

const componentsDir = join('.storyblok', 'components', SPACE);

function makeDiff(stale: string[]): DiffResult {
  return {
    diffs: stale.map(name => ({
      type: 'component',
      name,
      action: 'stale',
      changes: [],
      before: null,
      after: null,
    })),
    creates: 0,
    updates: 0,
    unchanged: 0,
    stale: stale.length,
  };
}

function makeSchema(overrides: Partial<SchemaData> = {}): SchemaData {
  return {
    components: [],
    datasources: [],
    ...overrides,
  };
}

describe('writeLocalComponents', () => {
  const ui = getUI();
  const logger = getLogger();
  vi.spyOn(ui, 'warn').mockImplementation(() => {});

  afterEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  it('writes one JSON file per component', async () => {
    const resolved = makeSchema({
      components: [
        { name: 'hero', schema: { title: { type: 'text' } }, component_group_uuid: null } as any,
        { name: 'page', schema: { body: { type: 'bloks' } }, component_group_uuid: null } as any,
      ],
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved,
      diffResult: makeDiff([]),
      deleteRemoved: false,
      ui,
      logger,
    });

    const files = Object.keys(vol.toJSON()).map(stripDriveLetter);
    const heroFile = files.find(f => f.endsWith(join(componentsDir, 'hero.json')));
    const pageFile = files.find(f => f.endsWith(join(componentsDir, 'page.json')));
    expect(heroFile).toBeDefined();
    expect(pageFile).toBeDefined();
    const heroContent = JSON.parse(vol.readFileSync(heroFile!, 'utf-8') as string);
    expect(heroContent.name).toBe('hero');
    expect(heroContent.schema).toEqual({ title: { type: 'text' } });
  });

  it('never writes groups.json (component groups are not managed)', async () => {
    const resolved = makeSchema({
      components: [{ name: 'hero', schema: {}, component_group_uuid: null } as any],
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved,
      diffResult: makeDiff([]),
      deleteRemoved: false,
      ui,
      logger,
    });

    const files = Object.keys(vol.toJSON()).map(stripDriveLetter);
    expect(files.some(f => f.endsWith('groups.json'))).toBe(false);
  });

  it('removes stale groups.json when no folders remain', async () => {
    vol.fromJSON({
      [join(componentsDir, 'groups.json')]: JSON.stringify([{ name: 'Old', uuid: 'g1' }]),
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved: makeSchema({
        components: [{ name: 'hero', schema: {}, component_group_uuid: null } as any],
      }),
      diffResult: makeDiff([]),
      deleteRemoved: false,
      ui,
      logger,
    });

    const files = Object.keys(vol.toJSON()).map(stripDriveLetter);
    expect(files.some(f => f.endsWith(join(componentsDir, 'groups.json')))).toBe(false);
  });

  it('warns when a consolidated components.json already exists', async () => {
    const warnSpy = vi.spyOn(ui, 'warn').mockImplementation(() => {});
    vol.fromJSON({
      [join(componentsDir, 'components.json')]: '[]',
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved: makeSchema({
        components: [{ name: 'hero', schema: {}, component_group_uuid: null } as any],
      }),
      diffResult: makeDiff([]),
      deleteRemoved: false,
      ui,
      logger,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('A consolidated components.json exists'),
    );
  });

  it('does not warn when no consolidated file exists', async () => {
    const warnSpy = vi.spyOn(ui, 'warn').mockImplementation(() => {});

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved: makeSchema({
        components: [{ name: 'hero', schema: {}, component_group_uuid: null } as any],
      }),
      diffResult: makeDiff([]),
      deleteRemoved: false,
      ui,
      logger,
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('removes local files for stale components when deleteRemoved is true', async () => {
    vol.fromJSON({
      [join(componentsDir, 'footer.json')]: JSON.stringify({ name: 'footer', schema: {} }),
      [join(componentsDir, 'hero.json')]: JSON.stringify({ name: 'hero', schema: {} }),
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved: makeSchema({
        components: [{ name: 'hero', schema: {}, component_group_uuid: null } as any],
      }),
      diffResult: makeDiff(['footer']),
      deleteRemoved: true,
      ui,
      logger,
    });

    const files = Object.keys(vol.toJSON()).map(stripDriveLetter);
    expect(files.some(f => f.endsWith(join(componentsDir, 'footer.json')))).toBe(false);
    expect(files.some(f => f.endsWith(join(componentsDir, 'hero.json')))).toBe(true);
  });

  it('does not delete local files when deleteRemoved is false', async () => {
    vol.fromJSON({
      [join(componentsDir, 'footer.json')]: JSON.stringify({ name: 'footer', schema: {} }),
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved: makeSchema({
        components: [{ name: 'hero', schema: {}, component_group_uuid: null } as any],
      }),
      diffResult: makeDiff(['footer']),
      deleteRemoved: false,
      ui,
      logger,
    });

    const files = Object.keys(vol.toJSON()).map(stripDriveLetter);
    expect(files.some(f => f.endsWith(join(componentsDir, 'footer.json')))).toBe(true);
  });

  it('tolerates ENOENT when deleting a stale file that does not exist locally', async () => {
    await expect(
      writeLocalComponents({
        space: SPACE,
        basePath: undefined,
        resolved: makeSchema(),
        diffResult: makeDiff(['never-existed']),
        deleteRemoved: true,
        ui,
        logger,
      }),
    ).resolves.toBeUndefined();
  });

  it('sanitizes component names when computing filenames', async () => {
    const resolved = makeSchema({
      components: [{ name: 'foo/bar', schema: {}, component_group_uuid: null } as any],
    });

    await writeLocalComponents({
      space: SPACE,
      basePath: undefined,
      resolved,
      diffResult: makeDiff([]),
      deleteRemoved: false,
      ui,
      logger,
    });

    const files = Object.keys(vol.toJSON()).map(stripDriveLetter);
    expect(files.some(f => f.endsWith(join(componentsDir, 'foo_bar.json')))).toBe(true);
  });
});
