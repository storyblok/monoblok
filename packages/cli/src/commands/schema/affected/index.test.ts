import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';

import '../index';
import { schemaCommand } from '../command';
import type { SchemaData } from '../types';
import type { Component } from '../../../types';
import { DEFAULT_SPACE, getID } from '../../__tests__/helpers';

import { loadSchema } from '../load-schema';

// loadSchema uses jiti to dynamically import TypeScript entry files at runtime,
// which cannot be resolved in the test environment, so we mock it and provide
// the local schema directly.
vi.mock('../load-schema', () => ({
  loadSchema: vi.fn(),
}));

function makeComponent(name: string, schema: Record<string, Record<string, unknown>>): Component {
  return {
    id: getID(),
    name,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    is_root: false,
    is_nestable: true,
    schema,
  } as unknown as Component;
}

interface StoryFixture {
  id: number;
  uuid: string;
  name: string;
  full_slug: string;
  content: Record<string, unknown>;
}

const server = setupServer();

let storiesListCalls = 0;

const preconditions = {
  hasLocalSchema(components: Component[]) {
    vi.mocked(loadSchema).mockResolvedValue({ components, datasources: [] } satisfies SchemaData);
  },
  hasRemote(components: Component[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components })),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, () =>
        HttpResponse.json({ component_groups: [] })),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, () =>
        HttpResponse.json({ datasources: [] })),
    );
  },
  hasStories(stories: StoryFixture[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, () => {
        storiesListCalls += 1;
        return HttpResponse.json(
          { stories: stories.map(({ id, uuid, name, full_slug }) => ({ id, uuid, name, full_slug })) },
          { headers: { 'Total': String(stories.length), 'Per-Page': '100' } },
        );
      }),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`, ({ params }) => {
        const story = stories.find(s => String(s.id) === params.id);
        return HttpResponse.json({ story });
      }),
    );
  },
};

function readOutputReport() {
  const entry = Object.entries(vol.toJSON()).find(([filename]) => filename.endsWith('report.json'));
  return entry ? JSON.parse(entry[1] as string) : undefined;
}

async function runAffected(extraArgs: string[] = []) {
  await schemaCommand.parseAsync([
    'node',
    'test',
    'affected',
    'schema.ts',
    '--space',
    DEFAULT_SPACE,
    '--output',
    'report.json',
    ...extraArgs,
  ]);
}

describe('schema affected command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    storiesListCalls = 0;
  });

  afterAll(() => server.close());

  it('should flag stories missing a newly required field as broken', async () => {
    preconditions.hasLocalSchema([makeComponent('hero', { title: { type: 'text' }, subtitle: { type: 'text', required: true } })]);
    preconditions.hasRemote([makeComponent('hero', { title: { type: 'text' } })]);
    preconditions.hasStories([
      { id: 100, uuid: 'u-home', name: 'Home', full_slug: 'home', content: { _uid: 'r', component: 'hero', title: 'Hi' } },
    ]);

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 1, brokenStories: 1 });
    const hero = report.components.find((c: { component: string }) => c.component === 'hero');
    expect(hero).toMatchObject({ usedStories: 1, brokenStories: 1 });
    expect(hero.fields.find((f: { field: string }) => f.field === 'subtitle')).toMatchObject({ kind: 'required_added', broken: 1 });
  });

  it('should treat a removed field as affected but not broken', async () => {
    preconditions.hasLocalSchema([makeComponent('hero', { title: { type: 'text' } })]);
    preconditions.hasRemote([makeComponent('hero', { title: { type: 'text' }, subtitle: { type: 'text' } })]);
    preconditions.hasStories([
      { id: 101, uuid: 'u-a', name: 'A', full_slug: 'a', content: { _uid: 'r', component: 'hero', title: 'Hi', subtitle: 'orphan' } },
    ]);

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 1, brokenStories: 0 });
    expect(report.stories[0].issues.some((i: { code: string; severity: string }) => i.code === 'unknown_field' && i.severity === 'warning')).toBe(true);
  });

  it('should flag stories using a removed component as broken with --delete', async () => {
    preconditions.hasLocalSchema([makeComponent('page', { body: { type: 'bloks' } })]);
    preconditions.hasRemote([
      makeComponent('page', { body: { type: 'bloks' } }),
      makeComponent('teaser', { headline: { type: 'text' } }),
    ]);
    preconditions.hasStories([
      { id: 102, uuid: 'u-b', name: 'B', full_slug: 'b', content: { _uid: 'r', component: 'page', body: [{ _uid: 'x', component: 'teaser', headline: 'Hey' }] } },
    ]);

    await runAffected(['--delete']);

    const report = readOutputReport();
    const teaser = report.components.find((c: { component: string }) => c.component === 'teaser');
    expect(teaser).toMatchObject({ action: 'removed', brokenStories: 1 });
    expect(report.totals.brokenStories).toBe(1);
  });

  it('should not treat a removed component as affected without --delete', async () => {
    preconditions.hasLocalSchema([makeComponent('page', { body: { type: 'bloks' } })]);
    preconditions.hasRemote([
      makeComponent('page', { body: { type: 'bloks' } }),
      makeComponent('teaser', { headline: { type: 'text' } }),
    ]);
    preconditions.hasStories([]);

    await runAffected();

    expect(storiesListCalls).toBe(0);
    expect(readOutputReport()).toBeUndefined();
  });

  it('should union stories across multiple impacted components (MAPI contain_component is AND)', async () => {
    preconditions.hasLocalSchema([
      makeComponent('hero', { title: { type: 'text', required: true } }),
      makeComponent('teaser', { headline: { type: 'text', required: true } }),
    ]);
    preconditions.hasRemote([
      makeComponent('hero', { title: { type: 'text' } }),
      makeComponent('teaser', { headline: { type: 'text' } }),
    ]);

    // No single story uses both components, so a single AND-filtered request for
    // `hero,teaser` would return nothing. Only one request per component unions them.
    const stories: StoryFixture[] = [
      { id: 200, uuid: 'u-h', name: 'H', full_slug: 'h', content: { _uid: 'r', component: 'hero' } },
      { id: 201, uuid: 'u-t', name: 'T', full_slug: 't', content: { _uid: 'r', component: 'teaser' } },
    ];
    const componentsOf = (content: unknown): Set<string> => {
      const found = new Set<string>();
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(walk); return; }
        if (value && typeof value === 'object') {
          const component = (value as Record<string, unknown>).component;
          if (typeof component === 'string') { found.add(component); }
          Object.values(value).forEach(walk);
        }
      };
      walk(content);
      return found;
    };
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
        storiesListCalls += 1;
        const contain = new URL(request.url).searchParams.get('contain_component');
        const required = contain ? contain.split(',') : [];
        // Mirror MAPI: match stories whose component set is a superset of all requested names.
        const matched = stories.filter(story => required.every(name => componentsOf(story.content).has(name)));
        return HttpResponse.json(
          { stories: matched.map(({ id, uuid, name, full_slug }) => ({ id, uuid, name, full_slug })) },
          { headers: { 'Total': String(matched.length), 'Per-Page': '100' } },
        );
      }),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`, ({ params }) =>
        HttpResponse.json({ story: stories.find(story => String(story.id) === params.id) })),
    );

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 2, brokenStories: 2 });
    expect(report.components.map((c: { component: string }) => c.component).sort()).toEqual(['hero', 'teaser']);
  });

  it('should not fetch stories when there are no content-affecting changes', async () => {
    const shared = { title: { type: 'text' } };
    preconditions.hasLocalSchema([makeComponent('hero', shared)]);
    preconditions.hasRemote([makeComponent('hero', shared)]);
    preconditions.hasStories([]);

    await runAffected();

    expect(storiesListCalls).toBe(0);
    expect(readOutputReport()).toBeUndefined();
  });
});
