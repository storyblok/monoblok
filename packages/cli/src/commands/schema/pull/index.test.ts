import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';

import '../index';
import { schemaCommand } from '../command';
import { DEFAULT_SPACE, getID } from '../../__tests__/helpers';

vi.spyOn(console, 'log');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

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
  hasRemoteSchema(options: {
    components?: MockComponent[];
    folders?: MockFolder[];
    datasources?: MockDatasource[];
  } = {}) {
    this.hasRemoteComponents(options.components ?? []);
    this.hasRemoteFolders(options.folders ?? []);
    this.hasRemoteDatasources(options.datasources ?? []);
  },
  failsToFetchRemote() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })),
    );
  },
};

describe('schema pull command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });

  afterAll(() => server.close());

  it('should generate component files', async () => {
    const comp = makeMockComponent({ name: 'hero', is_nestable: true });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const componentFile = files.find(f => f.includes('/components/hero.ts'));
    expect(componentFile).toBeDefined();

    const content = vol.readFileSync(componentFile!, 'utf-8') as string;
    expect(content).toContain('defineBlock(');
    expect(content).toContain('name: \'hero\'');
    expect(content).toContain('defineField(');
    expect(content).toContain('defineProp(');
  });

  it('should generate folder files', async () => {
    const folder = makeMockFolder({ name: 'Content Blocks' });
    preconditions.hasRemoteSchema({ folders: [folder] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const folderFile = files.find(f => f.includes('/components/folders/content-blocks.ts'));
    expect(folderFile).toBeDefined();

    const content = vol.readFileSync(folderFile!, 'utf-8') as string;
    expect(content).toContain('defineBlockFolder(');
    expect(content).toContain('name: \'Content Blocks\'');
  });

  it('should generate datasource files', async () => {
    const ds = makeMockDatasource({ name: 'Categories', slug: 'categories' });
    preconditions.hasRemoteSchema({ datasources: [ds] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const dsFile = files.find(f => f.includes('/datasources/categories.ts'));
    expect(dsFile).toBeDefined();

    const content = vol.readFileSync(dsFile!, 'utf-8') as string;
    expect(content).toContain('defineDatasource(');
    expect(content).toContain('name: \'Categories\'');
    expect(content).toContain('slug: \'categories\'');
  });

  it('should generate schema.ts with schema object and types', async () => {
    const comp = makeMockComponent({ name: 'page', is_root: true });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());

    const schemaFile = files.find(f => f.endsWith('/schema.ts'));
    expect(schemaFile).toBeDefined();
    const schemaContent = vol.readFileSync(schemaFile!, 'utf-8') as string;
    expect(schemaContent).toContain('export const schema = {');
    expect(schemaContent).toContain('pageBlock,');
    expect(schemaContent).toContain('InferSchema<typeof schema>');
    expect(schemaContent).toContain('export type Story = InferStory');
  });

  it('should write to .storyblok/schema by default', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('.storyblok/schema/components/hero.ts'))).toBe(true);
    expect(files.some(f => f.includes('.storyblok/schema/schema.ts'))).toBe(true);
  });

  it('should respect --out-dir option', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE, '--out-dir', './custom/output']);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('custom/output/components/hero.ts'))).toBe(true);
    expect(files.some(f => f.includes('custom/output/schema.ts'))).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    preconditions.failsToFetchRemote();

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    // Should not throw — error is handled
  });

  it('should handle empty remote space', async () => {
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // Should still generate schema.ts even with no entities
    expect(files.some(f => f.endsWith('/schema.ts'))).toBe(true);
  });

  it('should warn that pull is a bootstrap step', async () => {
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('bootstrap step'));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('source of truth'));
  });

  it('should strip API-only fields but preserve user-settable fields in generated code', async () => {
    const comp = makeMockComponent({
      name: 'hero',
      schema: {
        title: { type: 'text', pos: 0, id: 'api-field-id' },
      },
    });
    (comp as any).internal_tag_ids = [10, 20];
    (comp as any).metadata = { some: 'data' };

    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'pull', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const componentFile = files.find(f => f.includes('/components/hero.ts'));
    expect(componentFile).toBeDefined();

    const content = vol.readFileSync(componentFile!, 'utf-8') as string;
    // internal_tag_ids is user-settable (in ComponentCreate/Update), so it's preserved
    expect(content).toContain('internal_tag_ids');
    expect(content).not.toContain('metadata');
    expect(content).not.toContain('api-field-id');
  });
});
