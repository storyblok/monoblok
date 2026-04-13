import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import { confirm, select } from '@inquirer/prompts';

import '../index';
import { schemaCommand } from '../command';
import { DEFAULT_SPACE, getID } from '../../__tests__/helpers';
import type { ChangesetData } from '../types';

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
}));

vi.spyOn(console, 'log');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');
vi.spyOn(console, 'error');

interface MockComponent {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  schema: Record<string, Record<string, unknown>>;
}

function makeMockComponent(overrides: Partial<MockComponent> = {}): MockComponent {
  const id = getID();
  return {
    id,
    name: `component-${id}`,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    schema: { title: { type: 'text', pos: 0 } },
    ...overrides,
  };
}

function makeChangeset(changes: ChangesetData['changes'], overrides: Partial<ChangesetData> = {}): ChangesetData {
  return {
    timestamp: '2026-04-10T12:00:00.000Z',
    spaceId: Number(DEFAULT_SPACE),
    remote: { components: [], componentFolders: [], datasources: [] },
    changes,
    ...overrides,
  };
}

const CHANGESET_PATH = `.storyblok/schema/changesets/2026-04-10T12-00-00-000Z.json`;

const server = setupServer();

const preconditions = {
  hasChangeset(changeset: ChangesetData) {
    vol.fromJSON({
      [CHANGESET_PATH]: JSON.stringify(changeset),
    });
  },
  hasRemoteComponents(components: MockComponent[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components })),
    );
  },
  hasRemoteFolders() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, () =>
        HttpResponse.json({ component_groups: [] })),
    );
  },
  hasRemoteDatasources() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, () =>
        HttpResponse.json({ datasources: [] })),
    );
  },
  hasEmptyRemote() {
    this.hasRemoteComponents([]);
    this.hasRemoteFolders();
    this.hasRemoteDatasources();
  },
  canCreateComponents() {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, async ({ request }) => {
        const body = await request.json() as { component: { name: string } };
        return HttpResponse.json({ component: { id: getID(), ...body.component } });
      }),
    );
  },
  canDeleteComponents() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, () =>
        HttpResponse.json({})),
    );
  },
  canUpdateComponents() {
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, async ({ request }) => {
        const body = await request.json() as { component: MockComponent };
        return HttpResponse.json({ component: body.component });
      }),
    );
  },
  confirmsPrompt() {
    vi.mocked(confirm).mockResolvedValue(true);
  },
  cancelsPrompt() {
    vi.mocked(confirm).mockResolvedValue(false);
  },
};

describe('schema rollback command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });

  afterAll(() => server.close());

  it('should show diff and stop in dry-run mode', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]));
    // no remote fetch needed in dry-run (we stop before that)

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
      '--dry-run',
    ]);

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
    // msw configured with onUnhandledRequest: 'error' — no fetch handlers registered, so any HTTP call would fail
  });

  it('should cancel when user declines confirmation', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]));
    preconditions.cancelsPrompt();
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
  });

  it('should roll back a create by deleting the component', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]));
    preconditions.confirmsPrompt();
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    // A new rollback changeset should be saved
    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('schema/changesets/') && f !== CHANGESET_PATH)).toBe(true);
  });

  it('should roll back an update by restoring the before state', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    const before = { ...comp, display_name: 'Old Hero' };
    const after = { ...comp, display_name: 'New Hero' };
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'update', before, after },
    ]));
    preconditions.confirmsPrompt();
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('schema/changesets/') && f !== CHANGESET_PATH)).toBe(true);
  });

  it('should roll back a delete by recreating the component', async () => {
    const comp = makeMockComponent({ name: 'footer' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'footer', action: 'delete', before: { ...comp } },
    ]));
    preconditions.confirmsPrompt();
    preconditions.hasEmptyRemote();
    preconditions.canCreateComponents();

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('schema/changesets/') && f !== CHANGESET_PATH)).toBe(true);
  });

  it('should warn when changeset has no changes', async () => {
    preconditions.hasChangeset(makeChangeset([]));

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('nothing to roll back'));
  });

  it('should list changesets and prompt when no file is specified', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    const changeset = makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]);
    vol.fromJSON({
      [CHANGESET_PATH]: JSON.stringify(changeset),
    });
    vi.mocked(select).mockResolvedValue(CHANGESET_PATH);
    // dry-run so we don't need remote fetch or confirm
    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      '--space',
      DEFAULT_SPACE,
      '--dry-run',
    ]);

    expect(select).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
  });

  it('should warn when no changesets are found', async () => {
    vol.fromJSON({});

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      '--space',
      DEFAULT_SPACE,
    ]);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No changesets found'));
  });

  it('should skip confirmation prompt with --yes', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]));
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
      '--yes',
    ]);

    expect(confirm).not.toHaveBeenCalled();
    // Verify rollback was executed (changeset saved)
    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('schema/changesets/') && f !== CHANGESET_PATH)).toBe(true);
  });

  it('should prompt for confirmation without --yes', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]));
    preconditions.confirmsPrompt();
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    expect(confirm).toHaveBeenCalled();
  });

  it('should auto-select the most recent changeset with --latest', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    const changeset = makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]);
    vol.fromJSON({
      [CHANGESET_PATH]: JSON.stringify(changeset),
    });

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      '--space',
      DEFAULT_SPACE,
      '--latest',
      '--dry-run',
    ]);

    expect(select).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
  });

  it('should warn when --latest is used but no changesets exist', async () => {
    vol.fromJSON({});

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      '--space',
      DEFAULT_SPACE,
      '--latest',
    ]);

    expect(select).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No changesets found'));
  });

  it('should handle API errors gracefully', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasChangeset(makeChangeset([
      { type: 'component', name: 'hero', action: 'create', after: { ...comp } },
    ]));
    preconditions.confirmsPrompt();
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })),
    );

    await schemaCommand.parseAsync([
      'node',
      'test',
      'rollback',
      CHANGESET_PATH,
      '--space',
      DEFAULT_SPACE,
    ]);

    expect(console.error).toHaveBeenCalled();
  });
});
