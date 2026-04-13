import { describe, expect, it } from 'vitest';

import type { Component, ComponentFolder, Datasource } from '../../../types';
import type { DiffResult, RemoteSchemaData, SchemaData } from '../types';
import { buildChangesetEntries, formatDiffOutput, toComponentCreate, toComponentFolderCreate, toDatasourceCreate, toDatasourceUpdate } from './actions';

describe('toComponentCreate', () => {
  it('should strip API-assigned fields from a component', () => {
    const component = {
      id: 99,
      name: 'page',
      display_name: 'Page',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      is_root: true,
      is_nestable: false,
      schema: { title: { type: 'text', pos: 0 } },
      real_name: 'page',
      all_presets: [],
      preset_id: null,
      image: null,
      preview_tmpl: null,
    } as unknown as Component;

    const result = toComponentCreate(component);

    expect(result).toEqual({
      name: 'page',
      display_name: 'Page',
      color: '',
      icon: '',
      preview_field: '',
      is_root: true,
      is_nestable: false,
      schema: { title: { type: 'text', pos: 0 } },
      internal_tag_ids: [],
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('updated_at');
    expect(result).not.toHaveProperty('real_name');
    expect(result).not.toHaveProperty('all_presets');
    expect(result).not.toHaveProperty('image');
  });

  it('should always include reset values for nullable string fields even when not set locally', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      schema: {},
      // display_name, color, icon, preview_field intentionally absent
    } as unknown as Component;

    const result = toComponentCreate(component);

    expect(result).toMatchObject({
      name: 'hero',
      display_name: '',
      color: '',
      icon: '',
      preview_field: '',
      internal_tag_ids: [],
    });
  });
});

describe('toDatasourceCreate', () => {
  it('should strip API-assigned fields from a datasource', () => {
    const datasource = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceCreate(datasource);

    expect(result).toEqual({ name: 'Colors', slug: 'colors' });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('created_at');
  });

  it('should map dimensions to dimensions_attributes with only name and entry_value', () => {
    const datasource = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      dimensions: [
        { id: 1, name: 'German', entry_value: 'de', datasource_id: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Spanish', entry_value: 'es', datasource_id: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceCreate(datasource);

    expect(result).toEqual({
      name: 'Colors',
      slug: 'colors',
      dimensions_attributes: [
        { name: 'German', entry_value: 'de' },
        { name: 'Spanish', entry_value: 'es' },
      ],
    });
  });

  it('should send empty dimensions_attributes when dimensions is empty (clears remote dimensions)', () => {
    const datasource = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      dimensions: [],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceCreate(datasource);

    expect(result).toEqual({ name: 'Colors', slug: 'colors', dimensions_attributes: [] });
  });

  it('should skip malformed dimension entries', () => {
    const datasource = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      dimensions: [
        { id: 1, name: 'German', entry_value: 'de' },
        { name: 123, entry_value: 'bad' },
        'not-an-object',
        { id: 3, name: 'French' },
      ],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceCreate(datasource);

    expect(result.dimensions_attributes).toEqual([
      { name: 'German', entry_value: 'de' },
    ]);
  });
});

describe('toDatasourceUpdate', () => {
  it('should add _destroy entries for remote dimensions not in local', () => {
    const local = {
      name: 'Colors',
      slug: 'colors',
      dimensions: [],
    } as unknown as Datasource;

    const remote = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      dimensions: [
        { id: 10, name: 'German', entry_value: 'de', datasource_id: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 11, name: 'Spanish', entry_value: 'es', datasource_id: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceUpdate(local, remote);

    expect(result).toEqual({
      name: 'Colors',
      slug: 'colors',
      dimensions_attributes: [
        { id: 10, _destroy: true },
        { id: 11, _destroy: true },
      ],
    });
  });

  it('should keep local dimensions and destroy only removed remote ones', () => {
    const local = {
      name: 'Colors',
      slug: 'colors',
      dimensions: [
        { name: 'German', entry_value: 'de' },
      ],
    } as unknown as Datasource;

    const remote = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      dimensions: [
        { id: 10, name: 'German', entry_value: 'de', datasource_id: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 11, name: 'Spanish', entry_value: 'es', datasource_id: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceUpdate(local, remote);

    expect(result).toEqual({
      name: 'Colors',
      slug: 'colors',
      dimensions_attributes: [
        { name: 'German', entry_value: 'de' },
        { id: 11, _destroy: true },
      ],
    });
  });

  it('should return base payload when remote has no dimensions', () => {
    const local = {
      name: 'Colors',
      slug: 'colors',
      dimensions: [
        { name: 'German', entry_value: 'de' },
      ],
    } as unknown as Datasource;

    const remote = {
      id: 5,
      name: 'Colors',
      slug: 'colors',
      dimensions: [],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as unknown as Datasource;

    const result = toDatasourceUpdate(local, remote);

    expect(result).toEqual({
      name: 'Colors',
      slug: 'colors',
      dimensions_attributes: [
        { name: 'German', entry_value: 'de' },
      ],
    });
  });
});

describe('toComponentFolderCreate', () => {
  it('should strip API-assigned fields from a folder', () => {
    const folder = {
      id: 3,
      name: 'Layout',
      uuid: 'abc-123',
      parent_id: 1,
    } as unknown as ComponentFolder;

    const result = toComponentFolderCreate(folder);

    expect(result).toEqual({ name: 'Layout', parent_id: 1 });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('uuid');
  });
});

describe('buildChangesetEntries', () => {
  function makeDiffResult(diffs: DiffResult['diffs']): DiffResult {
    return {
      diffs,
      creates: diffs.filter(d => d.action === 'create').length,
      updates: diffs.filter(d => d.action === 'update').length,
      unchanged: diffs.filter(d => d.action === 'unchanged').length,
      stale: diffs.filter(d => d.action === 'stale').length,
    };
  }

  const localComp = { id: 1, name: 'hero', schema: {} } as unknown as Component;
  const remoteComp = { id: 2, name: 'hero', schema: {} } as unknown as Component;
  const staleComp = { id: 3, name: 'footer', schema: {} } as unknown as Component;

  const baseLocal: SchemaData = { components: [localComp], componentFolders: [], datasources: [] };
  const baseRemote: RemoteSchemaData = {
    components: new Map([['hero', remoteComp], ['footer', staleComp]]),
    componentFolders: new Map(),
    datasources: new Map(),
  };

  it('should map create and update actions correctly', () => {
    const diffResult = makeDiffResult([
      { type: 'component', name: 'hero', action: 'update', diff: null, local: null, remote: null },
      { type: 'component', name: 'new-comp', action: 'create', diff: null, local: null, remote: null },
    ]);
    const local: SchemaData = {
      components: [localComp, { id: 4, name: 'new-comp', schema: {} } as unknown as Component],
      componentFolders: [],
      datasources: [],
    };

    const changes = buildChangesetEntries(diffResult, local, baseRemote, { delete: false });

    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({ type: 'component', name: 'hero', action: 'update' });
    expect(changes[1]).toMatchObject({ type: 'component', name: 'new-comp', action: 'create' });
  });

  it('should skip unchanged entries', () => {
    const diffResult = makeDiffResult([
      { type: 'component', name: 'hero', action: 'unchanged', diff: null, local: null, remote: null },
    ]);

    const changes = buildChangesetEntries(diffResult, baseLocal, baseRemote, { delete: false });

    expect(changes).toHaveLength(0);
  });

  it('should skip stale entries when delete option is false', () => {
    const diffResult = makeDiffResult([
      { type: 'component', name: 'footer', action: 'stale', diff: null, local: null, remote: null },
    ]);

    const changes = buildChangesetEntries(diffResult, baseLocal, baseRemote, { delete: false });

    expect(changes).toHaveLength(0);
  });

  it('should include stale as delete when delete option is true', () => {
    const diffResult = makeDiffResult([
      { type: 'component', name: 'footer', action: 'stale', diff: null, local: null, remote: null },
    ]);

    const changes = buildChangesetEntries(diffResult, baseLocal, baseRemote, { delete: true });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'component', name: 'footer', action: 'delete' });
  });

  it('should include before/after snapshots', () => {
    const diffResult = makeDiffResult([
      { type: 'component', name: 'hero', action: 'update', diff: null, local: null, remote: null },
    ]);

    const changes = buildChangesetEntries(diffResult, baseLocal, baseRemote, { delete: false });

    expect(changes[0]?.before).toBeDefined();
    expect(changes[0]?.after).toBeDefined();
    expect(changes[0]?.before).toMatchObject({ name: 'hero' });
    expect(changes[0]?.after).toMatchObject({ name: 'hero' });
  });
});

describe('formatDiffOutput', () => {
  function makeDiffResult(diffs: DiffResult['diffs']): DiffResult {
    return {
      diffs,
      creates: diffs.filter(d => d.action === 'create').length,
      updates: diffs.filter(d => d.action === 'update').length,
      unchanged: diffs.filter(d => d.action === 'unchanged').length,
      stale: diffs.filter(d => d.action === 'stale').length,
    };
  }

  it('should label stale entities as "stale" by default', () => {
    const diffResult = makeDiffResult([
      { type: 'datasource', name: 'Page Categories', action: 'stale', diff: null, local: null, remote: null },
    ]);

    const output = formatDiffOutput(diffResult);

    expect(output).toContain('(stale)');
    expect(output).toContain('1 stale');
  });

  it('should label stale entities as "delete" when delete option is true', () => {
    const diffResult = makeDiffResult([
      { type: 'datasource', name: 'Page Categories', action: 'stale', diff: null, local: null, remote: null },
    ]);

    const output = formatDiffOutput(diffResult, { delete: true });

    expect(output).toContain('(delete)');
    expect(output).toContain('1 to delete');
    expect(output).not.toContain('stale');
  });
});
