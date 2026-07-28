import { describe, expect, it, vi } from 'vitest';

import { assertNoLegacyFlags, generateSchemaTypes } from './index';

vi.mock('../../../schema/actions', () => ({
  fetchRemoteSchema: vi.fn(async () => ({
    remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
    rawComponents: [
      {
        id: 1,
        name: 'hero',
        created_at: '',
        updated_at: '',
        is_root: false,
        is_nestable: true,
        schema: { headline: { type: 'text', required: true, pos: 0 } },
      },
      {
        id: 2,
        name: 'page',
        created_at: '',
        updated_at: '',
        is_root: true,
        is_nestable: false,
        schema: { body: { type: 'bloks', pos: 0 } },
      },
    ],
    rawComponentFolders: [],
    rawDatasources: [],
  })),
}));

const written = new Map<string, string>();
vi.mock('../../../../utils/filesystem', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    saveToFile: vi.fn(async (path: string, content: string) => { written.set(path, content); }),
  };
});

describe('assertNoLegacyFlags', () => {
  it('accepts options that use no legacy-only flag', () => {
    expect(() => assertNoLegacyFlags({ typePrefix: 'Sb', separateFiles: true })).not.toThrow();
  });

  it('rejects --strict', () => {
    expect(() => assertNoLegacyFlags({ strict: true })).toThrow(/--strict/);
  });

  it('names every offending flag at once', () => {
    expect(() => assertNoLegacyFlags({ strict: true, customFieldsParser: './p.ts', compilerOptions: './c.json' }))
      .toThrow(/--strict.*--custom-fields-parser.*--compiler-options/s);
  });
});

describe('generateSchemaTypes', () => {
  it('writes a single file containing the shared surface', async () => {
    written.clear();

    const result = await generateSchemaTypes({
      space: '295018',
      cwd: '/project',
      outputDir: '/project/.storyblok/types/295018',
      filename: 'storyblok-schema',
    });

    expect(result.files).toEqual(['/project/.storyblok/types/295018/storyblok-schema.d.ts']);
    const content = written.get('/project/.storyblok/types/295018/storyblok-schema.d.ts')!;
    expect(content).toContain('export type HeroBlockDefinition = {');
    expect(content).toContain('export type PageBlockDefinition = {');
    expect(content).toContain('export type Blocks = HeroBlockDefinition | PageBlockDefinition;');
    expect(content).toContain('export type Block<TName extends Blocks[\'name\']>');
  });

  it('reports custom field types that have no registered plugin', async () => {
    written.clear();
    const { fetchRemoteSchema } = await import('../../../schema/actions');
    vi.mocked(fetchRemoteSchema).mockResolvedValueOnce({
      remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
      rawComponents: [{
        id: 1,
        name: 'hero',
        created_at: '',
        updated_at: '',
        is_root: false,
        is_nestable: true,
        schema: { accent: { type: 'custom', field_type: 'storyblok-colorpicker', pos: 0 } },
      }],
      rawComponentFolders: [],
      rawDatasources: [],
    } as never);

    const result = await generateSchemaTypes({
      space: '295018',
      cwd: '/project',
      outputDir: '/project/.storyblok/types/295018',
      filename: 'storyblok-schema',
    });

    expect(result.unmappedFieldTypes).toEqual(['storyblok-colorpicker']);
  });

  it('throws when the space has no components', async () => {
    const { fetchRemoteSchema } = await import('../../../schema/actions');
    vi.mocked(fetchRemoteSchema).mockResolvedValueOnce({
      remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
      rawComponents: [],
      rawComponentFolders: [],
      rawDatasources: [],
    } as never);

    await expect(generateSchemaTypes({
      space: '295018',
      cwd: '/project',
      outputDir: '/out',
      filename: 'storyblok-schema',
    })).rejects.toThrow(/no components/i);
  });
});
