import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';

import type { ChangesetData, RemoteSchemaData } from '../types';
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
});

describe('executeRollback', () => {
  const NEW_FOLDER_UUID = 'new-remote-folder-uuid-999';
  let capturedComponentBody: Record<string, unknown> | undefined;

  const handlers = [
    http.post('https://mapi.storyblok.com/v1/spaces/12345/component_groups', () => {
      return HttpResponse.json({
        component_group: {
          id: 100,
          name: 'Layout',
          uuid: NEW_FOLDER_UUID,
        },
      }, { status: 201 });
    }),
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

  it('should remap component_group_uuid to newly created folder UUID', async () => {
    const OLD_FOLDER_UUID = 'old-folder-uuid-123';

    const ops: RollbackOp[] = [
      {
        type: 'componentFolder',
        name: 'Layout',
        action: 'create',
        payload: { name: 'Layout', uuid: OLD_FOLDER_UUID },
      },
      {
        type: 'component',
        name: 'hero',
        action: 'create',
        payload: { name: 'hero', schema: {}, component_group_uuid: OLD_FOLDER_UUID },
      },
    ];

    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map(),
      datasources: new Map(),
    };

    await executeRollback('12345', ops, remote);

    const componentPayload = (capturedComponentBody as { component: Record<string, unknown> }).component;
    expect(componentPayload.component_group_uuid).toBe(NEW_FOLDER_UUID);
  });
});
