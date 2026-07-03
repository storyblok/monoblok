import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';

import '../index';
import { storiesCommand } from '../command';
import { resetReporter } from '../../../lib/reporter/reporter';
import { session } from '../../../session';
import { loggedOutSessionState } from '../../../../test/setup';
import { makeMockStory } from '../__tests__/helpers';
import type { MockStory } from '../__tests__/helpers';

// Mock jiti so the loader classifies a controlled schema module.
let schemaModule: Record<string, unknown> = {};
vi.mock('jiti', () => ({
  createJiti: () => ({
    import: async () => schemaModule,
  }),
}));

vi.spyOn(console, 'log');

const server = setupServer();

const preconditions = {
  canListStories(stories: MockStory[], params: Record<string, string> = {}) {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/12345/stories', ({ request }) => {
        const url = new URL(request.url);
        const matches = Object.entries(params).every(([key, value]) => url.searchParams.get(key) === value);
        const page = Number(url.searchParams.get('page') ?? 1);
        return HttpResponse.json(
          { stories: matches && page === 1 ? stories : [] },
          { headers: { 'Total': String(stories.length), 'Per-Page': '100' } },
        );
      }),
    );
  },
  canFetchStories(stories: MockStory[]) {
    for (const story of stories) {
      server.use(http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${story.id}`, () =>
        HttpResponse.json({ story })));
    }
  },
  listEndpointFails() {
    server.use(http.get('https://mapi.storyblok.com/v1/spaces/12345/stories', () =>
      HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })));
  },
  storyFetchFails(id: MockStory['id']) {
    server.use(http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${id}`, () =>
      HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })));
  },
};

function loggedOutput(): string {
  return (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(call => String(call[0])).join('\n');
}

async function runValidate(...args: string[]): Promise<void> {
  await storiesCommand.parseAsync(['node', 'test', 'validate', '--space', '12345', '--schema', 'src/schema.ts', ...args]);
}

describe('stories validate command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    // A `page` block with a required `headline` text field.
    schemaModule = {
      page: { name: 'page', fields: [{ name: 'headline', type: 'text', required: true }] },
    };
  });
  afterEach(() => {
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  it('should exit 0 when every story matches the schema', async () => {
    const stories = [
      makeMockStory({ full_slug: 'home', content: { component: 'page', headline: 'Hi' } }),
      makeMockStory({ full_slug: 'about', content: { component: 'page', headline: 'About' } }),
    ];
    preconditions.canListStories(stories);
    preconditions.canFetchStories(stories);

    await runValidate();

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain('0 errors, 0 warnings across 0 of 2 stories');
  });

  it('should exit 1 and report missing required (error) and unknown field (warning)', async () => {
    const story = makeMockStory({
      id: 123456,
      full_slug: 'app/home',
      content: { component: 'page', legacy_cta: 'x' },
    });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate();

    expect(process.exitCode).toBe(1);
    const output = loggedOutput();
    expect(output).toContain('app/home (story #123456)');
    expect(output).toContain('missing_required_field');
    expect(output).toContain('unknown_field');
    expect(output).toContain('1 error, 1 warning across 1 of 1 stories');
  });

  it('should skip folders and exclude them from the total', async () => {
    const folder = makeMockStory({ full_slug: 'blog', is_folder: true });
    const story = makeMockStory({ full_slug: 'home', content: { component: 'page', headline: 'Hi' } });
    preconditions.canListStories([folder, story]);
    // Only the non-folder story is registered for fetch; if the folder were
    // fetched, msw's onUnhandledRequest:'error' would fail the test.
    preconditions.canFetchStories([story]);

    await runValidate();

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain('across 0 of 1 stories');
  });

  it('should exit 1 and count per-story fetch failures', async () => {
    const story = makeMockStory({ id: 999, full_slug: 'broken', content: { component: 'page', headline: 'Hi' } });
    preconditions.canListStories([story]);
    preconditions.storyFetchFails(story.id);

    await runValidate();

    expect(process.exitCode).toBe(1);
  });

  it('should exit 2 when the list endpoint is down', async () => {
    preconditions.listEndpointFails();

    await runValidate();

    expect(process.exitCode).toBe(2);
  });

  it('should exit 2 when --schema is omitted', async () => {
    await storiesCommand.parseAsync(['node', 'test', 'validate', '--space', '12345']);

    expect(process.exitCode).toBe(2);
  });

  it('should exit 2 when the schema entry exports no definitions', async () => {
    schemaModule = { helper: () => {} };
    const story = makeMockStory({ content: { component: 'page' } });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate();

    expect(process.exitCode).toBe(2);
  });

  it('should scope validation with --starts-with', async () => {
    const story = makeMockStory({ full_slug: 'en/home', content: { component: 'page', headline: 'Hi' } });
    preconditions.canListStories([story], { starts_with: '/en/' });
    preconditions.canFetchStories([story]);

    await runValidate('--starts-with', '/en/');

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain('across 0 of 1 stories');
  });

  it('should exit 2 when not logged in', async () => {
    // `preAction` calls `initializeSession`; make that one call land logged out.
    vi.mocked(session().initializeSession).mockImplementationOnce(async () => {
      session().state = loggedOutSessionState();
    });

    await runValidate();

    expect(process.exitCode).toBe(2);
  });
});
