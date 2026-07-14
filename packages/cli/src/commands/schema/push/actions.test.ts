import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Component, ComponentFolder, Datasource } from '../../../types';
import type { DiffResult, RemoteSchemaData, SchemaData } from '../types';
import { getMapiClient } from '../../../api';
import { buildChangesetEntries, executePush, formatDiffOutput } from './actions';
import { toComponentCreate, toDatasourceCreate, toDatasourceUpdate } from '../transform';

describe('toComponentCreate', () => {
  it('should strip API-assigned fields from a component', () => {
    const component = {
      id: 99,
      name: 'page',
      display_name: 'Page',
      description: 'A test block',
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
      description: 'A test block',
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
      // display_name, description, color, icon, preview_field intentionally absent
    } as unknown as Component;

    const result = toComponentCreate(component);

    expect(result).toMatchObject({
      name: 'hero',
      display_name: '',
      description: '',
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

  const baseLocal: SchemaData = { components: [localComp], folders: [], datasources: [] };
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
      folders: [],
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

  it('should map a folder create diff to a folder entry with the slug-path name and local after snapshot', () => {
    const localFolder = { name: 'Layout', path: 'layout', parentPath: null };
    const local: SchemaData = { components: [], folders: [localFolder], datasources: [] };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'layout', action: 'create', diff: null, local: null, remote: null },
    ]);

    const changes = buildChangesetEntries(diffResult, local, baseRemote, { delete: false });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'folder', name: 'layout', action: 'create' });
    expect(changes[0]?.before).toBeUndefined();
    expect(changes[0]?.after).toMatchObject({ name: 'Layout', path: 'layout' });
  });

  it('should map a stale folder diff to a delete entry with the remote before snapshot when delete is enabled', () => {
    const remoteFolder = { id: 10, uuid: 'uuid-layout', name: 'Layout', parent_id: null, parent_uuid: null } as unknown as ComponentFolder;
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([['Layout', remoteFolder]]),
      datasources: new Map(),
    };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'layout', action: 'stale', diff: null, local: null, remote: null },
    ]);

    const changes = buildChangesetEntries(diffResult, baseLocal, remote, { delete: true });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'folder', name: 'layout', action: 'delete' });
    expect(changes[0]?.after).toBeUndefined();
    expect(changes[0]?.before).toMatchObject({ name: 'Layout', uuid: 'uuid-layout' });
  });
});

describe('executePush - folders', () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    getMapiClient({ personalAccessToken: 'test-token', region: 'eu' });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  function makeDiffResult(diffs: DiffResult['diffs']): DiffResult {
    return {
      diffs,
      creates: diffs.filter(d => d.action === 'create').length,
      updates: diffs.filter(d => d.action === 'update').length,
      unchanged: diffs.filter(d => d.action === 'unchanged').length,
      stale: diffs.filter(d => d.action === 'stale').length,
    };
  }

  function emptyRemote(): RemoteSchemaData {
    return { components: new Map(), componentFolders: new Map(), datasources: new Map() };
  }

  const CREATE_GROUPS_URL = 'https://mapi.storyblok.com/v1/spaces/12345/component_groups';
  const CREATE_COMPONENTS_URL = 'https://mapi.storyblok.com/v1/spaces/12345/components';

  it('creates folders parent-first with the child parent_id set to the parent returned id', async () => {
    const createdGroups: Array<{ name: string; parent_id?: number | null }> = [];
    let nextId = 100;
    server.use(
      http.post(CREATE_GROUPS_URL, async ({ request }) => {
        const body = await request.json() as { component_group: { name: string; parent_id?: number | null } };
        createdGroups.push(body.component_group);
        const id = nextId++;
        return HttpResponse.json({
          component_group: {
            id,
            uuid: `uuid-${body.component_group.name.toLowerCase()}`,
            name: body.component_group.name,
            parent_id: body.component_group.parent_id ?? null,
            parent_uuid: null,
          },
        }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [],
      folders: [
        { name: 'Layout', path: 'layout', parentPath: null },
        { name: 'Heros', path: 'layout/heros', parentPath: 'layout' },
      ],
      datasources: [],
    };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'layout', action: 'create', diff: null, local: null, remote: null },
      { type: 'folder', name: 'layout/heros', action: 'create', diff: null, local: null, remote: null },
    ]);

    const result = await executePush('12345', local, emptyRemote(), diffResult, { delete: false });

    expect(createdGroups).toHaveLength(2);
    expect(createdGroups[0].name).toBe('Layout');
    expect(createdGroups[0].parent_id ?? null).toBeNull();
    expect(createdGroups[1].name).toBe('Heros');
    expect(createdGroups[1].parent_id).toBe(100);
    expect(result.created).toBe(2);
  });

  it('throws when creating a folder fails, without upserting the component', async () => {
    let componentCreateCalled = false;
    server.use(
      http.post(CREATE_GROUPS_URL, () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }),
      http.post(CREATE_COMPONENTS_URL, async () => {
        componentCreateCalled = true;
        return HttpResponse.json({ component: { id: 400, name: 'hero' } }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [{ name: 'hero', folder: 'layout', schema: {} } as unknown as Component],
      folders: [
        { name: 'Layout', path: 'layout', parentPath: null },
      ],
      datasources: [],
    };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'layout', action: 'create', diff: null, local: null, remote: null },
      { type: 'component', name: 'hero', action: 'create', diff: null, local: null, remote: null },
    ]);

    await expect(executePush('12345', local, emptyRemote(), diffResult, { delete: false }))
      .rejects
      .toThrow(/folder/i);
    expect(componentCreateCalled).toBe(false);
  });

  it('throws when a folder create returns 2xx but the body omits id/uuid, without upserting the component', async () => {
    let componentCreateCalled = false;
    server.use(
      http.post(CREATE_GROUPS_URL, () => {
        // 2xx but malformed: no id/uuid to register the group with.
        return HttpResponse.json({ component_group: { name: 'Layout' } }, { status: 201 });
      }),
      http.post(CREATE_COMPONENTS_URL, async () => {
        componentCreateCalled = true;
        return HttpResponse.json({ component: { id: 400, name: 'hero' } }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [{ name: 'hero', folder: 'layout', schema: {} } as unknown as Component],
      folders: [{ name: 'Layout', path: 'layout', parentPath: null }],
      datasources: [],
    };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'layout', action: 'create', diff: null, local: null, remote: null },
      { type: 'component', name: 'hero', action: 'create', diff: null, local: null, remote: null },
    ]);

    await expect(executePush('12345', local, emptyRemote(), diffResult, { delete: false }))
      .rejects
      .toThrow(/id and uuid/i);
    expect(componentCreateCalled).toBe(false);
  });

  it('surfaces a delete error (not a silent skip) when a stale folder path does not resolve to a remote group', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/12345/component_groups/:id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    // Remote has a group that resolves to path 'old'; the stale diff names a
    // non-resolving path, so the delete would otherwise be skipped silently.
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([
        ['Old', { id: 10, uuid: 'uuid-old', name: 'Old', parent_uuid: null } as unknown as ComponentFolder],
      ]),
      datasources: new Map(),
    };
    const local: SchemaData = { components: [], folders: [], datasources: [] };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'ghost', action: 'stale', diff: null, local: null, remote: null },
    ]);

    await expect(executePush('12345', local, remote, diffResult, { delete: true }))
      .rejects
      .toThrow(/folder ghost/i);
    expect(deleteCalled).toBe(false);
  });

  it('throws when deleting a stale folder fails under --delete', async () => {
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/12345/component_groups/:id', () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }),
    );

    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([
        ['Old', { id: 10, uuid: 'uuid-old', name: 'Old', parent_uuid: null } as unknown as ComponentFolder],
      ]),
      datasources: new Map(),
    };
    const local: SchemaData = { components: [], folders: [], datasources: [] };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'old', action: 'stale', diff: null, local: null, remote: null },
    ]);

    await expect(executePush('12345', local, remote, diffResult, { delete: true }))
      .rejects
      .toThrow(/folder/i);
  });

  it('resolves a local component folder path to the created group uuid and strips folder', async () => {
    let capturedComponent: Record<string, unknown> | undefined;
    let nextId = 200;
    server.use(
      http.post(CREATE_GROUPS_URL, async ({ request }) => {
        const body = await request.json() as { component_group: { name: string; parent_id?: number | null } };
        const id = nextId++;
        return HttpResponse.json({
          component_group: {
            id,
            uuid: `uuid-${body.component_group.name.toLowerCase()}`,
            name: body.component_group.name,
            parent_id: body.component_group.parent_id ?? null,
            parent_uuid: null,
          },
        }, { status: 201 });
      }),
      http.post(CREATE_COMPONENTS_URL, async ({ request }) => {
        const body = await request.json() as { component: Record<string, unknown> };
        capturedComponent = body.component;
        return HttpResponse.json({ component: { id: 300, name: 'hero' } }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [{ name: 'hero', folder: 'layout/heros', schema: {} } as unknown as Component],
      folders: [
        { name: 'Layout', path: 'layout', parentPath: null },
        { name: 'Heros', path: 'layout/heros', parentPath: 'layout' },
      ],
      datasources: [],
    };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'layout', action: 'create', diff: null, local: null, remote: null },
      { type: 'folder', name: 'layout/heros', action: 'create', diff: null, local: null, remote: null },
      { type: 'component', name: 'hero', action: 'create', diff: null, local: null, remote: null },
    ]);

    await executePush('12345', local, emptyRemote(), diffResult, { delete: false });

    expect(capturedComponent).toBeDefined();
    expect(capturedComponent!.component_group_uuid).toBe('uuid-heros');
    expect(capturedComponent).not.toHaveProperty('folder');
  });

  it('resolves component_group_whitelist slug paths to remote group uuids', async () => {
    let capturedComponent: Record<string, unknown> | undefined;
    server.use(
      http.post(CREATE_COMPONENTS_URL, async ({ request }) => {
        const body = await request.json() as { component: Record<string, unknown> };
        capturedComponent = body.component;
        return HttpResponse.json({ component: { id: 301, name: 'grid' } }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [{
        name: 'grid',
        schema: { blocks: { type: 'bloks', component_group_whitelist: ['layout'] } },
      } as unknown as Component],
      folders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([
        ['Layout', { id: 10, uuid: 'uuid-layout', name: 'Layout' } as unknown as ComponentFolder],
      ]),
      datasources: new Map(),
    };
    const diffResult = makeDiffResult([
      { type: 'component', name: 'grid', action: 'create', diff: null, local: null, remote: null },
    ]);

    await executePush('12345', local, remote, diffResult, { delete: false });

    expect(capturedComponent).toBeDefined();
    const schema = capturedComponent!.schema as Record<string, { component_group_whitelist: string[] }>;
    expect(schema.blocks.component_group_whitelist).toEqual(['uuid-layout']);
  });

  it('leaves an already-uuid component_group_whitelist untouched (schema init round-trip)', async () => {
    let capturedComponent: Record<string, unknown> | undefined;
    server.use(
      http.post(CREATE_COMPONENTS_URL, async ({ request }) => {
        const body = await request.json() as { component: Record<string, unknown> };
        capturedComponent = body.component;
        return HttpResponse.json({ component: { id: 303, name: 'grid' } }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [{
        name: 'grid',
        schema: { blocks: { type: 'bloks', component_group_whitelist: ['uuid-layout'] } },
      } as unknown as Component],
      folders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([
        ['Layout', { id: 10, uuid: 'uuid-layout', name: 'Layout' } as unknown as ComponentFolder],
      ]),
      datasources: new Map(),
    };
    const diffResult = makeDiffResult([
      { type: 'component', name: 'grid', action: 'create', diff: null, local: null, remote: null },
    ]);

    await executePush('12345', local, remote, diffResult, { delete: false });

    const schema = capturedComponent!.schema as Record<string, { component_group_whitelist: string[] }>;
    expect(schema.blocks.component_group_whitelist).toEqual(['uuid-layout']);
  });

  it('sends component_group_uuid: null when clearing a folder on update', async () => {
    let capturedComponent: Record<string, unknown> | undefined;
    server.use(
      http.put('https://mapi.storyblok.com/v1/spaces/12345/components/50', async ({ request }) => {
        const body = await request.json() as { component: Record<string, unknown> };
        capturedComponent = body.component;
        return HttpResponse.json({ component: { id: 50, name: 'hero' } });
      }),
    );

    const local: SchemaData = {
      components: [{ name: 'hero', folder: null, schema: {} } as unknown as Component],
      folders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map([['hero', { id: 50, name: 'hero', component_group_uuid: 'uuid-old', schema: {} } as unknown as Component]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };
    const diffResult = makeDiffResult([
      { type: 'component', name: 'hero', action: 'update', diff: null, local: null, remote: null },
    ]);

    await executePush('12345', local, remote, diffResult, { delete: false });

    expect(capturedComponent).toBeDefined();
    expect(capturedComponent).toHaveProperty('component_group_uuid', null);
  });

  it('deletes stale folders children-first with --delete', async () => {
    const deletedIds: number[] = [];
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/12345/component_groups/:id', ({ params }) => {
        deletedIds.push(Number(params.id));
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([
        ['Old', { id: 10, uuid: 'uuid-old', name: 'Old', parent_uuid: null } as unknown as ComponentFolder],
        ['Nested', { id: 11, uuid: 'uuid-nested', name: 'Nested', parent_id: 10, parent_uuid: 'uuid-old' } as unknown as ComponentFolder],
      ]),
      datasources: new Map(),
    };
    const local: SchemaData = { components: [], folders: [], datasources: [] };
    const diffResult = makeDiffResult([
      { type: 'folder', name: 'old', action: 'stale', diff: null, local: null, remote: null },
      { type: 'folder', name: 'old/nested', action: 'stale', diff: null, local: null, remote: null },
    ]);

    const result = await executePush('12345', local, remote, diffResult, { delete: true });

    expect(deletedIds).toEqual([11, 10]);
    expect(result.deleted).toBe(2);
  });

  it('still deletes stale folders when a stale component delete fails, then reports the error', async () => {
    const deletedGroupIds: number[] = [];
    server.use(
      // The default content type cannot be deleted -> 422.
      http.delete('https://mapi.storyblok.com/v1/spaces/12345/components/:id', () =>
        HttpResponse.json({ error: 'default content type' }, { status: 422 })),
      http.delete('https://mapi.storyblok.com/v1/spaces/12345/component_groups/:id', ({ params }) => {
        deletedGroupIds.push(Number(params.id));
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const remote: RemoteSchemaData = {
      components: new Map([
        ['page', { id: 5, name: 'page' } as unknown as Component],
      ]),
      componentFolders: new Map([
        ['Old', { id: 10, uuid: 'uuid-old', name: 'Old', parent_uuid: null } as unknown as ComponentFolder],
      ]),
      datasources: new Map(),
    };
    const local: SchemaData = { components: [], folders: [], datasources: [] };
    const diffResult = makeDiffResult([
      { type: 'component', name: 'page', action: 'stale', diff: null, local: null, remote: null },
      { type: 'folder', name: 'old', action: 'stale', diff: null, local: null, remote: null },
    ]);

    await expect(executePush('12345', local, remote, diffResult, { delete: true }))
      .rejects
      .toThrow(/Failed to delete component page/);
    // The stale folder was still deleted despite the component delete failure.
    expect(deletedGroupIds).toEqual([10]);
  });

  it('throws a CommandError when a component folder path cannot be resolved to a group', async () => {
    const local: SchemaData = {
      components: [{ name: 'hero', folder: 'unknown/path', schema: {} } as unknown as Component],
      folders: [],
      datasources: [],
    };
    const diffResult = makeDiffResult([
      { type: 'component', name: 'hero', action: 'create', diff: null, local: null, remote: null },
    ]);

    await expect(executePush('12345', local, emptyRemote(), diffResult, { delete: false }))
      .rejects
      .toThrow(/Unknown folder path "unknown\/path" for component "hero"/);
  });

  it('never adds component_group_uuid to an unmanaged component (no folder key)', async () => {
    let capturedComponent: Record<string, unknown> | undefined;
    server.use(
      http.post(CREATE_COMPONENTS_URL, async ({ request }) => {
        const body = await request.json() as { component: Record<string, unknown> };
        capturedComponent = body.component;
        return HttpResponse.json({ component: { id: 302, name: 'hero' } }, { status: 201 });
      }),
    );

    const local: SchemaData = {
      components: [{ name: 'hero', schema: {} } as unknown as Component],
      folders: [],
      datasources: [],
    };
    const diffResult = makeDiffResult([
      { type: 'component', name: 'hero', action: 'create', diff: null, local: null, remote: null },
    ]);

    await executePush('12345', local, emptyRemote(), diffResult, { delete: false });

    expect(capturedComponent).toBeDefined();
    expect(capturedComponent).not.toHaveProperty('component_group_uuid');
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
