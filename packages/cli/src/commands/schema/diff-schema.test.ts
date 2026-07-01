import { describe, expect, it } from 'vitest';

import type { RemoteSchemaData, SchemaData } from './types';
import { diffSchema } from './diff-schema';

function makeComponent(name: string, schema: Record<string, unknown>) {
  return { id: 1, name, created_at: '', updated_at: '', schema } as any;
}

function makeDatasource(name: string, slug: string) {
  return { id: 1, name, slug, created_at: '', updated_at: '' } as any;
}

describe('diffSchema', () => {
  it('should detect new entities as create', () => {
    const local: SchemaData = {
      components: [makeComponent('page', { title: { type: 'text', pos: 0 } })],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.creates).toBe(1);
    expect(result.diffs[0].action).toBe('create');
    expect(result.diffs[0].name).toBe('page');
  });

  it('should detect unchanged entities', () => {
    const comp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    const local: SchemaData = {
      components: [comp],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map([['page', { ...comp, id: 99 }]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.unchanged).toBe(1);
    expect(result.diffs[0].action).toBe('unchanged');
  });

  it('should detect updated entities with diff string', () => {
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0, max_length: 70 } });
    const remoteComp = makeComponent('page', { title: { type: 'text', pos: 0, max_length: 60 } });

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['page', { ...remoteComp, id: 99 }]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.updates).toBe(1);
    expect(result.diffs[0].action).toBe('update');
    expect(result.diffs[0].diff).toContain('max_length');
  });

  it('should detect stale remote entities', () => {
    const local: SchemaData = { components: [], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['footer', makeComponent('footer', {})]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.stale).toBe(1);
    expect(result.diffs[0].action).toBe('stale');
    expect(result.diffs[0].name).toBe('footer');
  });

  it('should not show diff for auto-populated defaults (e.g. internal_tag_ids)', () => {
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    // Remote has internal_tag_ids: [] auto-populated by Storyblok, local doesn't set it
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), internal_tag_ids: [] };

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['page', remoteComp]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe('unchanged');
  });

  it('should show diff when local explicitly sets internal_tag_ids differently from remote', () => {
    const localComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), internal_tag_ids: [10] };
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), internal_tag_ids: [] };

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['page', remoteComp]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.updates).toBe(1);
    expect(result.diffs[0].action).toBe('update');
  });

  it('should not show diff when remote has an empty description and local does not set it', () => {
    const localComp = makeComponent('test', { title: { type: 'text', pos: 0 } });
    const remoteComp = { ...makeComponent('test', { title: { type: 'text', pos: 0 } }), description: '' };

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['test', remoteComp]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it('should show diff when local removes a remote description', () => {
    const localComp = makeComponent('test', { title: { type: 'text', pos: 0 } });
    const remoteComp = { ...makeComponent('test', { title: { type: 'text', pos: 0 } }), description: 'A test block' };

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['test', remoteComp]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.updates).toBe(1);
    expect(result.diffs[0].action).toBe('update');
  });

  it('should treat datasource without dimensions as unchanged when remote has empty dimensions', () => {
    const local: SchemaData = {
      components: [],
      datasources: [makeDatasource('Colors', 'colors')],
    };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map(),
      datasources: new Map([['Colors', { ...makeDatasource('Colors', 'colors'), dimensions: [] } as any]]),
    };

    const result = diffSchema(local, remote);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe('unchanged');
  });

  it('should not diff component_group_uuid when local does not opt into the escape hatch', () => {
    const localComp = makeComponent('page', { title: { type: 'text', pos: 0 } });
    // Remote block belongs to a UI-managed group; local leaves it unset.
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), component_group_uuid: 'group-uuid' };

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['page', remoteComp]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it('should diff component_group_uuid when local sets it (group escape hatch)', () => {
    const localComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), component_group_uuid: 'new-group' };
    const remoteComp = { ...makeComponent('page', { title: { type: 'text', pos: 0 } }), component_group_uuid: 'old-group' };

    const local: SchemaData = { components: [localComp], datasources: [] };
    const remote: RemoteSchemaData = {
      components: new Map([['page', remoteComp]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.updates).toBe(1);
    expect(result.diffs[0].action).toBe('update');
    expect(result.diffs[0].diff).toContain('component_group_uuid');
  });

  it('should handle all entity types together (component groups are not diffed)', () => {
    const local: SchemaData = {
      components: [makeComponent('page', {})],
      datasources: [makeDatasource('Colors', 'colors')],
    };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = diffSchema(local, remote);

    expect(result.creates).toBe(2);
    expect(result.diffs).toHaveLength(2);
  });
});
