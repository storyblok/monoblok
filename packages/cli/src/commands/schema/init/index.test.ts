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

describe('schema init command', () => {
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

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const componentFile = files.find(f => f.includes('/blocks/hero.ts'));
    expect(componentFile).toBeDefined();

    const content = vol.readFileSync(componentFile!, 'utf-8') as string;
    expect(content).toContain('defineBlock(');
    expect(content).toContain('name: \'hero\'');
    expect(content).toContain('defineField(');
  });

  it('should mirror component groups as slugified directories (no folder files)', async () => {
    const folder = makeMockFolder({ name: 'My Layout', uuid: 'layout-uuid' });
    const comp = makeMockComponent({ name: 'hero', component_group_uuid: 'layout-uuid' } as any);
    preconditions.hasRemoteSchema({ components: [comp], folders: [folder] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // The block is placed inside its slugified group directory; no folder file is written.
    const componentFile = files.find(f => f.includes('/blocks/my-layout/hero.ts'));
    expect(componentFile).toBeDefined();
    expect(files.some(f => f.includes('/blocks/folders/'))).toBe(false);

    const content = vol.readFileSync(componentFile!, 'utf-8') as string;
    expect(content).toContain('defineBlock(');
    expect(content).not.toContain('defineBlockFolder');
    // Groups aren't part of a content-shape definition, so the field is dropped.
    expect(content).not.toContain('component_group_uuid');

    // schema.ts imports the block from its slugified subdirectory.
    const schemaFile = vol.readFileSync(files.find(f => f.endsWith('/schema.ts'))!, 'utf-8') as string;
    expect(schemaFile).toContain('./blocks/my-layout/hero');
  });

  it('should generate datasource files', async () => {
    const ds = makeMockDatasource({ name: 'Categories', slug: 'categories' });
    preconditions.hasRemoteSchema({ datasources: [ds] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const dsFile = files.find(f => f.includes('/datasources/categories.ts'));
    expect(dsFile).toBeDefined();

    const content = vol.readFileSync(dsFile!, 'utf-8') as string;
    expect(content).toContain('defineDatasource(');
    expect(content).toContain('name: \'Categories\'');
    expect(content).toContain('slug: \'categories\'');
  });

  it('generates valid identifiers for datasource names containing special characters', async () => {
    const ds = makeMockDatasource({ name: 'Colors & Sizes', slug: 'colors-sizes' });
    preconditions.hasRemoteSchema({ datasources: [ds] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());

    // Datasource file name is shell-safe.
    const dsFile = files.find(f => f.includes('/datasources/colors-sizes.ts'));
    expect(dsFile).toBeDefined();
    const dsContent = vol.readFileSync(dsFile!, 'utf-8') as string;
    expect(dsContent).toContain('export const colorsSizesDatasource = defineDatasource({');

    // schema.ts import, export reference, and key all agree and contain no `&`.
    const schemaFile = files.find(f => f.endsWith('/schema.ts'));
    expect(schemaFile).toBeDefined();
    const schemaContent = vol.readFileSync(schemaFile!, 'utf-8') as string;
    expect(schemaContent).toContain('import { colorsSizesDatasource } from \'./datasources/colors-sizes\';');
    expect(schemaContent).toContain('    colorsSizesDatasource,');
    expect(schemaContent).not.toContain('&');
  });

  it('writes distinct files when component names collapse to the same kebab-case file name', async () => {
    // `hero_cta` and `hero-cta` are distinct component names that both kebab to
    // `hero-cta`. Without dedup the second file would overwrite the first while
    // schema.ts still imports two symbols from the one path (uncompilable TS).
    const comps = [
      makeMockComponent({ name: 'hero_cta' }),
      makeMockComponent({ name: 'hero-cta' }),
    ];
    preconditions.hasRemoteSchema({ components: comps });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // Both blocks land in their own file — no overwrite.
    expect(files.some(f => f.endsWith('/blocks/hero-cta.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('/blocks/hero-cta-2.ts'))).toBe(true);

    // schema.ts imports each block from a distinct existing path.
    const schemaContent = vol.readFileSync(files.find(f => f.endsWith('/schema.ts'))!, 'utf-8') as string;
    expect(schemaContent).toContain('from \'./blocks/hero-cta\';');
    expect(schemaContent).toContain('from \'./blocks/hero-cta-2\';');
  });

  it('keeps a shared file name for colliding blocks in different group directories', async () => {
    // `hero_cta` and `hero-cta` both kebab to `hero-cta`, but they live in
    // different group directories — they don't collide on disk, so each keeps
    // the shared file name and its import carries the distinguishing subpath.
    const folderA = makeMockFolder({ name: 'Group A', uuid: 'group-a-uuid' });
    const folderB = makeMockFolder({ name: 'Group B', uuid: 'group-b-uuid' });
    const comps = [
      makeMockComponent({ name: 'hero_cta', component_group_uuid: 'group-a-uuid' } as any),
      makeMockComponent({ name: 'hero-cta', component_group_uuid: 'group-b-uuid' } as any),
    ];
    preconditions.hasRemoteSchema({ components: comps, folders: [folderA, folderB] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.endsWith('/blocks/group-a/hero-cta.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('/blocks/group-b/hero-cta.ts'))).toBe(true);

    const schemaContent = vol.readFileSync(files.find(f => f.endsWith('/schema.ts'))!, 'utf-8') as string;
    expect(schemaContent).toContain('from \'./blocks/group-a/hero-cta\';');
    expect(schemaContent).toContain('from \'./blocks/group-b/hero-cta\';');
  });

  it('should generate schema.ts with schema object and types', async () => {
    const comp = makeMockComponent({ name: 'page', is_root: true });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());

    const schemaFile = files.find(f => f.endsWith('/schema.ts'));
    expect(schemaFile).toBeDefined();
    const schemaContent = vol.readFileSync(schemaFile!, 'utf-8') as string;
    expect(schemaContent).toContain('export const schema = defineSchema({');
    expect(schemaContent).toContain('pageBlock,');
    expect(schemaContent).toContain('InferSchema<typeof schema>');
    expect(schemaContent).toContain('export type Story = InferStory');
  });

  it('should write to .storyblok/schema by default', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('.storyblok/schema/blocks/hero.ts'))).toBe(true);
    expect(files.some(f => f.includes('.storyblok/schema/schema.ts'))).toBe(true);
  });

  it('should respect --out-dir option', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE, '--out-dir', './custom/output']);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('custom/output/blocks/hero.ts'))).toBe(true);
    expect(files.some(f => f.includes('custom/output/schema.ts'))).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    preconditions.failsToFetchRemote();

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    // Should not throw — error is handled
  });

  it('should handle empty remote space', async () => {
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // Should still generate schema.ts even with no entities
    expect(files.some(f => f.endsWith('/schema.ts'))).toBe(true);
  });

  it('should warn that init is a bootstrap step', async () => {
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

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

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const componentFile = files.find(f => f.includes('/blocks/hero.ts'));
    expect(componentFile).toBeDefined();

    const content = vol.readFileSync(componentFile!, 'utf-8') as string;
    // internal_tag_ids is user-settable (in ComponentCreate/Update), so it's preserved
    expect(content).toContain('internal_tag_ids');
    expect(content).not.toContain('metadata');
    expect(content).not.toContain('api-field-id');
  });

  it('should list generated files as paths relative to the current working directory', async () => {
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    expect(console.log).toHaveBeenCalledWith('  .storyblok/schema/blocks/hero.ts');
    expect(console.log).toHaveBeenCalledWith('  .storyblok/schema/schema.ts');
  });

  it('should refuse when the target directory is not empty', async () => {
    vol.fromJSON({
      '.storyblok/schema/blocks/existing.ts': '// existing',
    });
    let unhandledRequest = false;
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () => {
        unhandledRequest = true;
        return HttpResponse.json({ components: [] });
      }),
    );

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    expect(unhandledRequest).toBe(false);
    const schemaFiles = Object.keys(vol.toJSON()).filter(f => f.includes('.storyblok/schema/'));
    expect(schemaFiles).toEqual(expect.arrayContaining([expect.stringContaining('existing.ts')]));
    expect(schemaFiles.some(f => f.includes('schema.ts'))).toBe(false);
  });

  it('should treat a directory containing only hidden files as empty', async () => {
    vol.fromJSON({
      '.storyblok/schema/.gitkeep': '',
      '.storyblok/schema/.DS_Store': '',
    });
    const comp = makeMockComponent({ name: 'hero' });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(['node', 'test', 'init', '--space', DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some(f => f.includes('.storyblok/schema/blocks/hero.ts'))).toBe(true);
  });
});
