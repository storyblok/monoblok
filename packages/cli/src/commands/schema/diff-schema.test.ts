import { describe, expect, it } from 'vitest';

import type { Component, Datasource } from '../../types';
import type { LocalFolder, NormalizedSchema } from './types';
import { diffSchema } from './diff-schema';

function makeComponent(name: string, schema: Record<string, unknown>) {
  return { id: 1, name, created_at: '', updated_at: '', schema } as unknown as Component;
}

function makeDatasource(name: string, slug: string) {
  return { id: 1, name, slug, created_at: '', updated_at: '' } as unknown as Datasource;
}

/** Builds a {@link NormalizedSchema} from entity arrays. */
function normalized(components: Component[] = [], datasources: Datasource[] = [], folders: LocalFolder[] = []): NormalizedSchema {
  return {
    components: new Map(components.map(c => [c.name, c])),
    datasources: new Map(datasources.map(d => [d.name, d])),
    folders: new Map(folders.map(f => [f.path, f])),
  };
}

// `diffSchema(from, to)` describes how to get from base (`from`) to target (`to`).
// For push semantics, from = remote, to = local.
describe('diffSchema', () => {
  it('should detect entities only in the target as create', () => {
    const from = normalized();
    const to = normalized([makeComponent('page', { title: { type: 'text', pos: 0 } })]);

    const result = diffSchema(from, to);

    expect(result.creates).toBe(1);
    expect(result.diffs[0].action).toBe('create');
    expect(result.diffs[0].name).toBe('page');
    expect(result.diffs[0].after).toMatchObject({ name: 'page' });
  });

  it('should detect unchanged entities', () => {
    const comp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    const from = normalized([{ ...comp, id: 99 } as Component]);
    const to = normalized([comp]);

    const result = diffSchema(from, to);

    expect(result.unchanged).toBe(1);
    expect(result.diffs[0].action).toBe('unchanged');
  });

  it('should detect updated entities with field-level changes', () => {
    const remoteComp = makeComponent('page', { title: { type: 'text', pos: 0, max_length: 60 } });
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0, max_length: 70 } });

    const result = diffSchema(normalized([{ ...remoteComp, id: 99 } as Component]), normalized([localComp]));

    expect(result.updates).toBe(1);
    expect(result.diffs[0].action).toBe('update');
    const titleChange = result.diffs[0].changes.find(c => c.field === 'title');
    expect(titleChange?.change).toBe('modified');
    expect(titleChange?.before).toMatchObject({ max_length: 60 });
    expect(titleChange?.after).toMatchObject({ max_length: 70 });
  });

  it('should report an added schema field as an added change', () => {
    const remoteComp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0 }, subtitle: { type: 'text', pos: 1 } });

    const result = diffSchema(normalized([{ ...remoteComp, id: 99 } as Component]), normalized([localComp]));

    const subtitle = result.diffs[0].changes.find(c => c.field === 'subtitle');
    expect(subtitle?.change).toBe('added');
    expect(subtitle?.after).toMatchObject({ type: 'text' });
  });

  it('should report a removed schema field as a removed change', () => {
    const remoteComp = makeComponent('page', { title: { type: 'text', pos: 0 }, subtitle: { type: 'text', pos: 1 } });
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0 } });

    const result = diffSchema(normalized([{ ...remoteComp, id: 99 } as Component]), normalized([localComp]));

    const subtitle = result.diffs[0].changes.find(c => c.field === 'subtitle');
    expect(subtitle?.change).toBe('removed');
    expect(subtitle?.before).toMatchObject({ type: 'text' });
  });

  it('should detect entities only in the base as stale', () => {
    const from = normalized([makeComponent('footer', {})]);
    const to = normalized();

    const result = diffSchema(from, to);

    expect(result.stale).toBe(1);
    expect(result.diffs[0].action).toBe('stale');
    expect(result.diffs[0].name).toBe('footer');
    expect(result.diffs[0].before).toMatchObject({ name: 'footer' });
  });

  it('should not show a change for auto-populated defaults (e.g. internal_tag_ids)', () => {
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), internal_tag_ids: [] } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it('should show a change when target explicitly sets internal_tag_ids differently', () => {
    const localComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), internal_tag_ids: [10] } as Component;
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), internal_tag_ids: [] } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some(c => c.field === 'internal_tag_ids')).toBe(true);
  });

  it('should not show a change when base has an empty description and target does not set it', () => {
    const localComp = makeComponent('test', { title: { type: 'text', pos: 0 } });
    const remoteComp = { ...makeComponent('test', { title: { type: 'text', pos: 0 } }), description: '' } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it('should show a change when the target removes a base description', () => {
    const localComp = makeComponent('test', { title: { type: 'text', pos: 0 } });
    const remoteComp = { ...makeComponent('test', { title: { type: 'text', pos: 0 } }), description: 'A test block' } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some(c => c.field === 'description')).toBe(true);
  });

  it('should treat a datasource without dimensions as unchanged when base has empty dimensions', () => {
    const from = normalized([], [{ ...makeDatasource('Colors', 'colors'), dimensions: [] } as unknown as Datasource]);
    const to = normalized([], [makeDatasource('Colors', 'colors')]);

    const result = diffSchema(from, to);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it('should not diff component_group_uuid when the target does not opt into the escape hatch', () => {
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), component_group_uuid: 'group-uuid' } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it('should diff component_group_uuid when the target sets it (group escape hatch)', () => {
    const localComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), component_group_uuid: 'new-group' } as Component;
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), component_group_uuid: 'old-group' } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some(c => c.field === 'component_group_uuid')).toBe(true);
  });

  it('should handle all entity types together', () => {
    const to = normalized([makeComponent('page', {})], [makeDatasource('Colors', 'colors')]);

    const result = diffSchema(normalized(), to);

    expect(result.creates).toBe(2);
    expect(result.diffs).toHaveLength(2);
  });
});
