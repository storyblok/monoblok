import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';

import '../index';
import { schemaCommand } from '../command';
import type { SchemaData } from '../types';
import type { Component } from '../../../types';
import { DEFAULT_SPACE, getID } from '../../__tests__/helpers';
import { getReporter, resetReporter } from '../../../lib/reporter/reporter';
import { konsola } from '../../../utils';

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
    vi.mocked(loadSchema).mockResolvedValue({ components, datasources: [], folders: [] } satisfies SchemaData);
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

// The detailed impact report is attached to the standard report file via
// `reporter.addMeta('schemaAffected', ...)`, so enable the reporter and read it back.
function readOutputReport() {
  const entry = Object.entries(vol.toJSON()).find(([filename]) => filename.endsWith('report.json'));
  return entry ? JSON.parse(entry[1] as string).meta?.schemaAffected : undefined;
}

async function runAffected(extraArgs: string[] = []) {
  resetReporter();
  getReporter({ enabled: true, filePath: 'report.json' });
  await schemaCommand.parseAsync([
    'node',
    'test',
    'affected',
    'schema.ts',
    '--space',
    DEFAULT_SPACE,
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
    resetReporter();
    storiesListCalls = 0;
    process.exitCode = undefined;
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

  it('should flag stories using a removed component as broken with --include-deleted', async () => {
    preconditions.hasLocalSchema([makeComponent('page', { body: { type: 'bloks' } })]);
    preconditions.hasRemote([
      makeComponent('page', { body: { type: 'bloks' } }),
      makeComponent('teaser', { headline: { type: 'text' } }),
    ]);
    preconditions.hasStories([
      { id: 102, uuid: 'u-b', name: 'B', full_slug: 'b', content: { _uid: 'r', component: 'page', body: [{ _uid: 'x', component: 'teaser', headline: 'Hey' }] } },
    ]);

    await runAffected(['--include-deleted']);

    const report = readOutputReport();
    const teaser = report.components.find((c: { component: string }) => c.component === 'teaser');
    expect(teaser).toMatchObject({ action: 'removed', brokenStories: 1 });
    expect(report.totals.brokenStories).toBe(1);
  });

  it('should not treat a removed component as affected without --include-deleted', async () => {
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

  it('should include a story that uses an impacted component only as its root content type', async () => {
    // `contain_component=page` never matches a story that uses `page` only as its
    // root type with no nested bloks — that story must be caught via the
    // `filter_query[component][in]` root-content-type request, or breakage is
    // silently under-reported (a false all-clear under --fail-on-break).
    preconditions.hasLocalSchema([makeComponent('page', { title: { type: 'text' }, subtitle: { type: 'text', required: true } })]);
    preconditions.hasRemote([makeComponent('page', { title: { type: 'text' } })]);

    const story: StoryFixture = { id: 300, uuid: 'u-p', name: 'P', full_slug: 'p', content: { _uid: 'r', component: 'page', title: 'Hi' } };
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
        storiesListCalls += 1;
        const url = new URL(request.url);
        // Only the root-content-type filter returns the flat story; contain_component does not.
        const rootIn = url.searchParams.get('filter_query[component][in]');
        const matched = rootIn?.split(',').includes('page') ? [story] : [];
        return HttpResponse.json(
          { stories: matched.map(({ id, uuid, name, full_slug }) => ({ id, uuid, name, full_slug })) },
          { headers: { 'Total': String(matched.length), 'Per-Page': '100' } },
        );
      }),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`, ({ params }) =>
        HttpResponse.json({ story: String(story.id) === params.id ? story : undefined })),
    );

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 1, brokenStories: 1 });
    expect(report.components.map((c: { component: string }) => c.component)).toEqual(['page']);
  });

  it('should exit non-zero with --fail-on-break when a story would break', async () => {
    preconditions.hasLocalSchema([makeComponent('hero', { title: { type: 'text' }, subtitle: { type: 'text', required: true } })]);
    preconditions.hasRemote([makeComponent('hero', { title: { type: 'text' } })]);
    preconditions.hasStories([
      { id: 100, uuid: 'u-home', name: 'Home', full_slug: 'home', content: { _uid: 'r', component: 'hero', title: 'Hi' } },
    ]);

    await runAffected(['--fail-on-break']);

    expect(process.exitCode).toBe(1);
  });

  it('should not set a non-zero exit code for breakage without --fail-on-break', async () => {
    preconditions.hasLocalSchema([makeComponent('hero', { title: { type: 'text' }, subtitle: { type: 'text', required: true } })]);
    preconditions.hasRemote([makeComponent('hero', { title: { type: 'text' } })]);
    preconditions.hasStories([
      { id: 100, uuid: 'u-home', name: 'Home', full_slug: 'home', content: { _uid: 'r', component: 'hero', title: 'Hi' } },
    ]);

    await runAffected();

    expect(process.exitCode).toBeUndefined();
  });

  it('should fail with actionable guidance when --local finds no pulled stories', async () => {
    const errorSpy = vi.spyOn(konsola, 'error').mockImplementation(() => konsola);
    preconditions.hasLocalSchema([makeComponent('hero', { title: { type: 'text' } })]);
    preconditions.hasRemote([makeComponent('hero', { title: { type: 'text' }, subtitle: { type: 'text' } })]);

    await runAffected(['--local']);

    expect(errorSpy.mock.calls.some(([message]) => typeof message === 'string' && message.includes('stories pull'))).toBe(true);
    // The guard returns before any analysis, so no impact report is attached.
    expect(readOutputReport()).toBeUndefined();
    // An operational failure must not be a green run, so CI gating can trust it.
    expect(process.exitCode).toBe(1);
  });

  it('should warn and exit non-zero when the entry file resolves to an empty schema', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    preconditions.hasLocalSchema([]);

    await runAffected();

    expect(warnSpy.mock.calls.some(([message]) => typeof message === 'string' && message.includes('No components or datasources'))).toBe(true);
    expect(process.exitCode).toBe(1);
    // A misconfigured entry-file must never diff nothing and report a false all-clear.
    expect(readOutputReport()).toBeUndefined();
  });

  it('should exit non-zero when the required --space is missing', async () => {
    vi.spyOn(konsola, 'error').mockImplementation(() => konsola);
    resetReporter();
    getReporter({ enabled: true, filePath: 'report.json' });

    await schemaCommand.parseAsync(['node', 'test', 'affected', 'schema.ts']);

    expect(process.exitCode).toBe(1);
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
