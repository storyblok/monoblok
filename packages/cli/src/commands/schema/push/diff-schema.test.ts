import { describe, expect, it } from 'vitest';

import type { RemoteSchemaData, SchemaData } from '../types';
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
      folders: [],
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
      folders: [],
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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
    const local: SchemaData = { components: [], folders: [], datasources: [] };
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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
      folders: [],
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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

    const local: SchemaData = { components: [localComp], folders: [], datasources: [] };
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
      folders: [],
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

  const remoteFolders = (folders: Array<{ uuid: string; name: string; parent_uuid?: string | null }>) =>
    new Map(folders.map(f => [f.name, { id: 1, parent_id: null, parent_uuid: null, ...f } as any]));

  it('should emit create diffs for local folders missing remotely', () => {
    const result = diffSchema(
      { components: [], datasources: [], folders: [{ name: 'Layout', path: 'layout', parentPath: null }] },
      { components: new Map(), datasources: new Map(), componentFolders: new Map() },
    );
    expect(result.diffs).toContainEqual(expect.objectContaining({ type: 'folder', name: 'layout', action: 'create' }));
  });

  it('should emit stale diffs for remote-only folders', () => {
    const result = diffSchema(
      { components: [], datasources: [], folders: [] },
      { components: new Map(), datasources: new Map(), componentFolders: remoteFolders([{ uuid: 'u1', name: 'Old' }]) },
    );
    expect(result.diffs).toContainEqual(expect.objectContaining({ type: 'folder', name: 'old', action: 'stale' }));
  });

  it('should match folders case-insensitively via slug paths', () => {
    const result = diffSchema(
      { components: [], datasources: [], folders: [{ name: 'layout', path: 'layout', parentPath: null }] },
      { components: new Map(), datasources: new Map(), componentFolders: remoteFolders([{ uuid: 'u1', name: 'Layout' }]) },
    );
    expect(result.diffs).toContainEqual(expect.objectContaining({ type: 'folder', name: 'layout', action: 'unchanged' }));
  });

  it('should diff component group membership in path space', () => {
    const local: SchemaData = {
      components: [{ ...makeComponent('hero', {}), folder: 'layout' }],
      datasources: [],
      folders: [{ name: 'Layout', path: 'layout', parentPath: null }],
    };
    const remoteComp = { ...makeComponent('hero', {}), component_group_uuid: 'u-other' };
    const remote: RemoteSchemaData = {
      components: new Map([['hero', remoteComp]]),
      datasources: new Map(),
      componentFolders: remoteFolders([{ uuid: 'u1', name: 'Layout' }, { uuid: 'u-other', name: 'Other' }]),
    };
    const diff = diffSchema(local, remote).diffs.find(d => d.type === 'component' && d.name === 'hero');
    expect(diff?.action).toBe('update');
  });

  it('should not diff groups for blocks without a folder key', () => {
    const local: SchemaData = {
      components: [makeComponent('hero', {})],
      datasources: [],
      folders: [],
    };
    const remoteComp = { ...makeComponent('hero', {}), component_group_uuid: 'u-layout' };
    const remote: RemoteSchemaData = {
      components: new Map([['hero', remoteComp]]),
      datasources: new Map(),
      componentFolders: remoteFolders([{ uuid: 'u-layout', name: 'Layout' }]),
    };
    const diff = diffSchema(local, remote).diffs.find(d => d.type === 'component' && d.name === 'hero');
    expect(diff?.action).toBe('unchanged');
  });

  it('should translate remote component_group_whitelist uuids to paths for diffing', () => {
    const local: SchemaData = {
      components: [
        makeComponent('page', {
          body: { type: 'bloks', pos: 0, restrict_components: true, component_group_whitelist: ['layout'] },
        }),
      ],
      datasources: [],
      folders: [{ name: 'Layout', path: 'layout', parentPath: null }],
    };
    const remoteComp = makeComponent('page', {
      body: { type: 'bloks', pos: 0, restrict_components: true, component_group_whitelist: ['u1'] },
    });
    const remote: RemoteSchemaData = {
      components: new Map([['page', remoteComp]]),
      datasources: new Map(),
      componentFolders: remoteFolders([{ uuid: 'u1', name: 'Layout' }]),
    };
    const diff = diffSchema(local, remote).diffs.find(d => d.type === 'component' && d.name === 'page');
    expect(diff?.action).toBe('unchanged');
  });

  it('should treat a local uuid whitelist as unchanged against the same remote uuid (schema init passthrough)', () => {
    // `schema init` emits raw uuid `component_group_whitelist` entries; both
    // sides must translate uuid → slug path so the whitelist does not diff forever.
    const local: SchemaData = {
      components: [
        makeComponent('page', {
          body: { type: 'bloks', pos: 0, restrict_components: true, component_group_whitelist: ['u1'] },
        }),
      ],
      datasources: [],
      folders: [{ name: 'Layout', path: 'layout', parentPath: null }],
    };
    const remoteComp = makeComponent('page', {
      body: { type: 'bloks', pos: 0, restrict_components: true, component_group_whitelist: ['u1'] },
    });
    const remote: RemoteSchemaData = {
      components: new Map([['page', remoteComp]]),
      datasources: new Map(),
      componentFolders: remoteFolders([{ uuid: 'u1', name: 'Layout' }]),
    };
    const diff = diffSchema(local, remote).diffs.find(d => d.type === 'component' && d.name === 'page');
    expect(diff?.action).toBe('unchanged');
  });

  it('should not mutate remote component objects across repeated diffs', () => {
    const local: SchemaData = {
      components: [{ ...makeComponent('hero', {}), folder: 'layout' }],
      datasources: [],
      folders: [{ name: 'Layout', path: 'layout', parentPath: null }],
    };
    const remoteComp = {
      ...makeComponent('hero', {
        body: { type: 'bloks', pos: 0, restrict_components: true, component_group_whitelist: ['u1'] },
      }),
      component_group_uuid: 'u1',
    };
    const remote: RemoteSchemaData = {
      components: new Map([['hero', remoteComp]]),
      datasources: new Map(),
      componentFolders: remoteFolders([{ uuid: 'u1', name: 'Layout' }]),
    };
    const first = diffSchema(local, remote).diffs.find(d => d.type === 'component' && d.name === 'hero');
    const snapshot = JSON.stringify(remoteComp);
    const second = diffSchema(local, remote).diffs.find(d => d.type === 'component' && d.name === 'hero');
    expect(JSON.stringify(remoteComp)).toBe(snapshot);
    expect(first?.action).toBe(second?.action);
  });
});
