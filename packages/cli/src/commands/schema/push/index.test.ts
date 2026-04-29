import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import { confirm } from '@inquirer/prompts';

import '../index';
import { schemaCommand } from '../command';
import type { SchemaData } from '../types';
import { DEFAULT_SPACE, getID } from '../../__tests__/helpers';

import { loadSchema } from './load-schema';

// loadSchema uses jiti to dynamically import TypeScript entry files at runtime.
// jiti cannot resolve @storyblok/schema imports in the test environment, so we
// mock this module and provide schema data directly via preconditions.
vi.mock('./load-schema', () => ({
  loadSchema: vi.fn(),
}));

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
  is_root?: boolean;
  is_nestable?: boolean;
}

interface MockFolder {
  id: number;
  name: string;
  uuid: string;
}

interface MockDatasource {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
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

function makeMockFolder(overrides: Partial<MockFolder> = {}): MockFolder {
  const id = getID();
  return { id, name: `Folder-${id}`, uuid: `uuid-${id}`, ...overrides };
}

function makeMockDatasource(overrides: Partial<MockDatasource> = {}): MockDatasource {
  const id = getID();
  return {
    id,
    name: `DS-${id}`,
    slug: `ds-${id}`,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

const server = setupServer();

const preconditions = {
  hasLocalSchema(schema: SchemaData) {
    vi.mocked(loadSchema).mockResolvedValue(schema);
  },
  hasRemoteComponents(components: MockComponent[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components })),
    );
  },
  hasRemoteFolders(folders: MockFolder[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, () =>
        HttpResponse.json({ component_groups: folders })),
    );
  },
  hasRemoteDatasources(datasources: MockDatasource[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, () =>
        HttpResponse.json({ datasources })),
    );
  },
  hasEmptyRemote() {
    this.hasRemoteComponents([]);
    this.hasRemoteFolders([]);
    this.hasRemoteDatasources([]);
  },
  canCreateComponents(components: MockComponent[]) {
    const created = components.map(c => ({ ...c, id: getID() }));
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, async ({ request }) => {
        const body = await request.json() as { component: { name: string } };
        const match = created.find(c => c.name === body.component.name);
        return HttpResponse.json({ component: match ?? created[0] });
      }),
    );
    return created;
  },
  canUpdateComponents() {
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, async ({ request }) => {
        const body = await request.json() as { component: MockComponent };
        return HttpResponse.json({ component: body.component });
      }),
    );
  },
  canDeleteComponents() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, () =>
        HttpResponse.json({})),
    );
  },
  canCreateFolders(folders: MockFolder[]) {
    const created = folders.map(f => ({ ...f, id: getID() }));
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, async ({ request }) => {
        const body = await request.json() as { component_group: { name: string } };
        const match = created.find(f => f.name === body.component_group.name);
        return HttpResponse.json({ component_group: match ?? created[0] });
      }),
    );
    return created;
  },
  canCreateDatasources(datasources: MockDatasource[]) {
    const created = datasources.map(d => ({ ...d, id: getID() }));
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, async ({ request }) => {
        const body = await request.json() as { datasource: { name: string } };
        const match = created.find(d => d.name === body.datasource.name);
        return HttpResponse.json({ datasource: match ?? created[0] });
      }),
    );
    return created;
  },
  canDeleteDatasources() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources/:id`, () =>
        HttpResponse.json({})),
    );
  },
  canDeleteFolders() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups/:id`, () =>
        HttpResponse.json({})),
    );
  },
  failsToFetchRemote() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })),
    );
  },
  confirmsMigrations() {
    vi.mocked(confirm).mockResolvedValue(true);
  },
  declinesPrompt() {
    vi.mocked(confirm).mockResolvedValue(false);
  },
};

describe('schema push command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });

  afterAll(() => server.close());

  it('should show diff and stop in dry-run mode', async () => {
    const localComp = makeMockComponent({ name: 'hero' });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--dry-run']);

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
    // msw is configured with onUnhandledRequest: 'error' and no POST/PUT/DELETE
    // handlers are registered, so any mutation attempt would fail the test.
  });

  it('should create new components when remote is empty', async () => {
    const localComp = makeMockComponent({ name: 'hero' });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasEmptyRemote();
    preconditions.canCreateComponents([localComp]);

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('schema/changesets/'))).toBe(true);
  });

  it('should detect unchanged components and skip push', async () => {
    const comp = makeMockComponent({ name: 'hero', schema: { title: { type: 'text', pos: 0 } } });
    preconditions.hasLocalSchema({
      components: [comp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('nothing to push'));
  });

  it('should show stale warning without --delete', async () => {
    const localComp = makeMockComponent({ name: 'hero', schema: { title: { type: 'text', pos: 0 } } });
    const staleComp = makeMockComponent({ name: 'footer' });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    // Stale entities appear in the diff output
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('stale'));
    // msw is configured with onUnhandledRequest: 'error' and no DELETE handlers
    // are registered, so any delete attempt would fail the test.
  });

  it('should delete stale entities with --delete', async () => {
    const localComp = makeMockComponent({ name: 'hero', schema: { title: { type: 'text', pos: 0 } } });
    const staleComp = makeMockComponent({ name: 'footer' });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--delete']);

    // Verify changeset only contains delete entries when --delete is set
    const changesetFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('schema/changesets/'))?.[1];
    const changeset = JSON.parse(changesetFile ?? '{}');
    expect(changeset.changes.some((c: { action: string }) => c.action === 'delete')).toBe(true);
  });

  it('should create all entity types', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    const folder = makeMockFolder({ name: 'Layout' });
    const ds = makeMockDatasource({ name: 'Colors', slug: 'colors' });

    preconditions.hasLocalSchema({
      components: [comp] as any,
      componentFolders: [folder] as any,
      datasources: [ds] as any,
    });
    preconditions.hasEmptyRemote();
    preconditions.canCreateComponents([comp]);
    preconditions.canCreateFolders([folder]);
    preconditions.canCreateDatasources([ds]);

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('schema/changesets/'))).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasLocalSchema({
      components: [comp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.failsToFetchRemote();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--dry-run']);

    // handleError outputs to console.error
    expect(console.error).toHaveBeenCalled();
  });

  it('should warn when entry file has zero exports', async () => {
    preconditions.hasLocalSchema({
      components: [],
      componentFolders: [],
      datasources: [],
    });

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    // ui.warn outputs to console.warn; verify the zero-export warning was shown
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No components, folders, or datasources'));
  });

  it('should not include stale entities in changeset without --delete', async () => {
    const localComp = makeMockComponent({ name: 'hero', schema: { title: { type: 'text', pos: 0 } } });
    const staleComp = makeMockComponent({ name: 'footer' });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    // Without --delete, the changeset should not contain delete entries for stale entities
    const changesetFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('schema/changesets/'))?.[1];
    const changeset = JSON.parse(changesetFile ?? '{}');
    expect(changeset.changes).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('nothing to push'));
  });

  it('should generate migration file when field is renamed', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        author_name: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        author: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();
    preconditions.confirmsMigrations();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    const migrationFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('migrations/') && filename.includes('hero.') && filename.endsWith('.js'));
    expect(migrationFile).toBeDefined();
    expect(migrationFile![1]).toContain('block.author = block.author_name');
    expect(migrationFile![1]).toContain('delete block.author_name');
  });

  it('should skip migration generation with --no-migrations', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        author_name: { type: 'text', pos: 0 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        author: { type: 'text', pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--no-migrations']);

    const migrationFiles = Object.keys(vol.toJSON()).filter(f => f.includes('migrations/') && f.endsWith('.js'));
    expect(migrationFiles).toHaveLength(0);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('should not generate migration files when user declines', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        subtitle: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        title: { type: 'text', pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();
    preconditions.declinesPrompt();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    const migrationFiles = Object.keys(vol.toJSON()).filter(f => f.includes('migrations/') && f.endsWith('.js'));
    expect(migrationFiles).toHaveLength(0);
  });

  it('should auto-generate migrations without prompting when --migrations is explicit', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        subtitle: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        title: { type: 'text', pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--migrations']);

    // Should generate without prompting
    const migrationFiles = Object.keys(vol.toJSON()).filter(f => f.includes('migrations/') && f.endsWith('.js'));
    expect(migrationFiles).toHaveLength(1);
    // confirm should NOT have been called (auto-generate mode)
    expect(confirm).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Generated migrations are scaffolds'));
  });

  it('should log assumed renames when --migrations is explicit', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        author_name: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        author: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--migrations']);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assumed rename'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('author_name'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('author'));
  });

  it('should generate migration for type changes', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        rating: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        rating: { type: 'number', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();
    preconditions.confirmsMigrations();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE]);

    const migrationFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('migrations/') && filename.includes('hero.') && filename.endsWith('.js'));
    expect(migrationFile).toBeDefined();
    expect(migrationFile![1]).toContain('Number(block.rating)');
  });

  it('should include review guidance in generated migration files', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        author_name: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        author: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync(['node', 'test', 'push', 'schema.ts', '--space', DEFAULT_SPACE, '--migrations']);

    const migrationFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('migrations/') && filename.includes('hero.') && filename.endsWith('.js'));
    expect(migrationFile).toBeDefined();
    expect(migrationFile![1]).toContain('Review this migration before running it against your space.');
    expect(migrationFile![1]).toContain('Generated migrations are scaffolds');
    expect(migrationFile![1]).toContain('block.new_field = block.old_field;');
  });

  it('should not write migration files when --dry-run is used with explicit --migrations', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        author_name: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        author: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);

    await schemaCommand.parseAsync([
      'node',
      'test',
      'push',
      'schema.ts',
      '--space',
      DEFAULT_SPACE,
      '--dry-run',
      '--migrations',
    ]);

    const migrationFiles = Object.keys(vol.toJSON())
      .filter(f => f.includes('migrations/') && f.endsWith('.js'));
    expect(migrationFiles).toHaveLength(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
  });

  it('should not prompt or write files when --dry-run is used with default migrations', async () => {
    const remoteComp = makeMockComponent({
      name: 'hero',
      schema: {
        subtitle: { type: 'text', pos: 0 },
        title: { type: 'text', pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: 'hero',
      schema: {
        title: { type: 'text', pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      componentFolders: [],
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);

    await schemaCommand.parseAsync([
      'node',
      'test',
      'push',
      'schema.ts',
      '--space',
      DEFAULT_SPACE,
      '--dry-run',
    ]);

    // Must not prompt — dry-run is non-interactive
    expect(confirm).not.toHaveBeenCalled();
    const migrationFiles = Object.keys(vol.toJSON())
      .filter(f => f.includes('migrations/') && f.endsWith('.js'));
    expect(migrationFiles).toHaveLength(0);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
  });
});
