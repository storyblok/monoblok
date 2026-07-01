import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';

import '../index';
import { schemaCommand } from '../command';
import type { SchemaData } from '../types';
import { resetReporter } from '../../../lib/reporter/reporter';
import { loadSchema } from '../load-schema';

// loadSchema uses jiti to import TypeScript entry files at runtime, which cannot
// resolve @storyblok/schema in the test environment; mock it and feed data directly.
vi.mock('../load-schema', () => ({
  loadSchema: vi.fn(),
}));

vi.spyOn(console, 'log');

const server = setupServer();

interface MockComponent {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  schema: Record<string, Record<string, unknown>>;
}

function comp(name: string, schema: Record<string, Record<string, unknown>>, id = 1): MockComponent {
  return { id, name, created_at: '2024-01-01', updated_at: '2024-01-01', schema };
}

/** Registers the three GET endpoints `fetchRemoteSchema` needs for a space. */
function spaceWith(space: string, components: MockComponent[]) {
  server.use(
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/components`, () =>
      HttpResponse.json({ components })),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/component_groups`, () =>
      HttpResponse.json({ component_groups: [] })),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/datasources`, () =>
      HttpResponse.json({ datasources: [] })),
  );
}

/** Reads the written diff report from the virtual filesystem. */
function getDiffReport() {
  const file = Object.entries(vol.toJSON()).find(([name]) => name.includes('schema-diff') && name.endsWith('.json'));
  return file ? JSON.parse(file[1] as string) : undefined;
}

describe('schema diff command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
  });

  afterAll(() => server.close());

  it('should diff two remote spaces and classify created, changed, and unchanged entities', async () => {
    spaceWith('111', [comp('hero', { title: { type: 'text', pos: 0 } })]);
    spaceWith('222', [
      comp('hero', { title: { type: 'text', pos: 0 }, subtitle: { type: 'text', pos: 1 } }, 2),
      comp('banner', { image: { type: 'asset', pos: 0 } }, 3),
    ]);

    await schemaCommand.parseAsync(['node', 'test', 'diff', '--from', '111', '--to', '222']);

    const report = getDiffReport();
    expect(report?.meta.diff.summary).toMatchObject({ create: 1, update: 1 });
    const entities = report.meta.diff.entities as { name: string; action: string }[];
    expect(entities.find(e => e.name === 'banner')?.action).toBe('create');
    expect(entities.find(e => e.name === 'hero')?.action).toBe('update');
  });

  it('should carry field-level changes in the report payload', async () => {
    spaceWith('111', [comp('hero', { title: { type: 'text', pos: 0 } })]);
    spaceWith('222', [comp('hero', { title: { type: 'text', pos: 0 }, subtitle: { type: 'text', pos: 1 } }, 2)]);

    await schemaCommand.parseAsync(['node', 'test', 'diff', '--from', '111', '--to', '222']);

    const report = getDiffReport();
    const hero = (report.meta.diff.entities as { name: string; changes: { field: string; change: string }[] }[])
      .find(e => e.name === 'hero');
    expect(hero?.changes.some(c => c.field === 'subtitle' && c.change === 'added')).toBe(true);
  });

  it('should diff a local entry file against a remote space', async () => {
    const local: SchemaData = {
      components: [comp('hero', { title: { type: 'text', pos: 0 } }) as unknown as SchemaData['components'][number]],
      datasources: [],
      folders: [],
    };
    vi.mocked(loadSchema).mockResolvedValue(local);
    spaceWith('222', []);

    await schemaCommand.parseAsync(['node', 'test', 'diff', '--from', './schema.ts', '--to', '222']);

    expect(loadSchema).toHaveBeenCalledWith('./schema.ts');
    const report = getDiffReport();
    // Local (to=remote 222 is empty, from=file has hero) → hero exists only in `from` → stale.
    expect(report?.meta.diff.summary).toMatchObject({ stale: 1 });
  });
});
