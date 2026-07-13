import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';

import type { ChangesetData, RemoteSchemaData } from '../types';
import type { Component, ComponentFolder } from '../../../types';
import { getMapiClient } from '../../../api';

import { buildRollbackOps, executeRollback, listChangesets } from './actions';
import type { RollbackOp } from './actions';

describe('listChangesets', () => {
  it('should return files sorted newest-first', async () => {
    vol.fromJSON({
      '.storyblok/schema/changesets/2026-04-09T10-00-00-000Z.json': '{}',
      '.storyblok/schema/changesets/2026-04-10T12-00-00-000Z.json': '{}',
      '.storyblok/schema/changesets/2026-04-08T08-00-00-000Z.json': '{}',
    });

    const result = await listChangesets('.storyblok');

    expect(result).toHaveLength(3);
    expect(result[0]).toContain('2026-04-10T12-00-00-000Z.json');
    expect(result[1]).toContain('2026-04-09T10-00-00-000Z.json');
    expect(result[2]).toContain('2026-04-08T08-00-00-000Z.json');
  });

  it('should return empty array when directory does not exist', async () => {
    vol.fromJSON({});

    const result = await listChangesets('.storyblok');

    expect(result).toEqual([]);
  });
});

describe('buildRollbackOps', () => {
  const baseChangeset: ChangesetData = {
    timestamp: '2026-04-10T12:00:00.000Z',
    spaceId: 12345,
    remote: { components: [], componentFolders: [], datasources: [] },
    changes: [],
  };

  it('should invert create to delete', () => {
    const changeset: ChangesetData = {
      ...baseChangeset,
      changes: [
        { type: 'component', name: 'hero', action: 'create', after: { name: 'hero', schema: {} } },
      ],
    };

    const ops = buildRollbackOps(changeset);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ type: 'component', name: 'hero', action: 'delete', payload: {} });
  });

  it('should invert update to update with before as payload', () => {
    const before = { name: 'hero', display_name: 'Old Hero', schema: {} };
    const changeset: ChangesetData = {
      ...baseChangeset,
      changes: [
        {
          type: 'component',
          name: 'hero',
          action: 'update',
          before,
          after: { name: 'hero', display_name: 'New Hero', schema: {} },
        },
      ],
    };

    const ops = buildRollbackOps(changeset);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ type: 'component', name: 'hero', action: 'update', payload: before });
  });

  it('should invert delete to create with before as payload', () => {
    const before = { name: 'footer', schema: {} };
    const changeset: ChangesetData = {
      ...baseChangeset,
      changes: [
        { type: 'component', name: 'footer', action: 'delete', before },
      ],
    };

    const ops = buildRollbackOps(changeset);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ type: 'component', name: 'footer', action: 'create', payload: before });
  });

  it('should return empty array for empty changes', () => {
    const ops = buildRollbackOps(baseChangeset);

    expect(ops).toEqual([]);
  });

  it('should invert folder create/delete generically', () => {
    const before = { id: 1, uuid: 'layout-uuid', name: 'Layout', parent_id: null, parent_uuid: null };
    const changeset: ChangesetData = {
      ...baseChangeset,
      changes: [
        { type: 'folder', name: 'layout/heros', action: 'create', after: { name: 'Heros', path: 'layout/heros', parentPath: 'layout' } },
        { type: 'folder', name: 'layout', action: 'delete', before },
      ],
    };

    const ops = buildRollbackOps(changeset);

    expect(ops[0]).toEqual({ type: 'folder', name: 'layout/heros', action: 'delete', payload: {} });
    expect(ops[1]).toEqual({ type: 'folder', name: 'layout', action: 'create', payload: before });
  });
});

describe('executeRollback', () => {
  let capturedComponentBody: Record<string, unknown> | undefined;

  const handlers = [
    http.post('https://mapi.storyblok.com/v1/spaces/12345/components', async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      capturedComponentBody = body;
      return HttpResponse.json({
        component: { id: 200, name: 'hero' },
      }, { status: 201 });
    }),
  ];

  const server = setupServer(...handlers);

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    getMapiClient({ personalAccessToken: 'test-token', region: 'eu' });
    vi.clearAllMocks();
  });
  afterEach(() => {
    server.resetHandlers();
    capturedComponentBody = undefined;
  });
  afterAll(() => server.close());

  it('should send a component create for a create rollback op', async () => {
    const ops: RollbackOp[] = [
      {
        type: 'component',
        name: 'hero',
        action: 'create',
        payload: { name: 'hero', schema: {} },
      },
    ];

    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = await executeRollback('12345', ops, remote);

    const componentPayload = (capturedComponentBody as { component: Record<string, unknown> }).component;
    expect(componentPayload.name).toBe('hero');
    expect(result.created).toBe(1);
  });

  it('should recreate a deleted folder and remap a restored component onto its new uuid', async () => {
    let capturedGroupBody: Record<string, unknown> | undefined;
    let capturedUpdateBody: Record<string, unknown> | undefined;
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/12345/component_groups', async ({ request }) => {
        capturedGroupBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { component_group: { id: 99, uuid: 'new-uuid', name: 'Heros', parent_id: null, parent_uuid: null } },
          { status: 201 },
        );
      }),
      http.put('https://mapi.storyblok.com/v1/spaces/12345/components/10', async ({ request }) => {
        capturedUpdateBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ component: { id: 10, name: 'hero' } }, { status: 200 });
      }),
    );

    // Rollback of a push that deleted folder `layout/heros` (old uuid) and
    // ungrouped `hero`. The folder is recreated (new uuid) and `hero` restored
    // onto it — its stored old uuid must be remapped to the new one.
    const ops: RollbackOp[] = [
      { type: 'folder', name: 'layout/heros', action: 'create', payload: { id: 5, uuid: 'old-uuid', name: 'Heros', parent_id: null, parent_uuid: null } },
      { type: 'component', name: 'hero', action: 'update', payload: { name: 'hero', component_group_uuid: 'old-uuid', schema: {} } },
    ];
    const remote: RemoteSchemaData = {
      components: new Map([['hero', { id: 10, name: 'hero' } as unknown as Component]]),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    const result = await executeRollback('12345', ops, remote);

    expect((capturedGroupBody as { component_group: Record<string, unknown> }).component_group.name).toBe('Heros');
    expect((capturedUpdateBody as { component: Record<string, unknown> }).component.component_group_uuid).toBe('new-uuid');
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('should delete folders the push created, children-first', async () => {
    const deletedIds: number[] = [];
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/12345/component_groups/:id', ({ params }) => {
        deletedIds.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const ops: RollbackOp[] = [
      { type: 'folder', name: 'layout', action: 'delete', payload: {} },
      { type: 'folder', name: 'layout/heros', action: 'delete', payload: {} },
    ];
    const layout: ComponentFolder = { id: 1, name: 'Layout', uuid: 'layout-uuid', parent_id: null, parent_uuid: null };
    const heros: ComponentFolder = { id: 2, name: 'Heros', uuid: 'heros-uuid', parent_id: 1, parent_uuid: 'layout-uuid' };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map([['Layout', layout], ['Heros', heros]]),
      datasources: new Map(),
    };

    const result = await executeRollback('12345', ops, remote);

    // Deepest path first: `layout/heros` (id 2) before `layout` (id 1).
    expect(deletedIds).toEqual([2, 1]);
    expect(result.deleted).toBe(2);
  });
});
