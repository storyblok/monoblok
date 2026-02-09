import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
// Import the main components module first to ensure proper initialization
import '../index';
import { storiesCommand } from '../command';
import type { StoriesQueryParams } from '../index';
import { getLogFileContents } from '../../__tests__/helpers';
import { makeMockStory, type MockStory, storyFileExists } from '../__tests__/helpers';

vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

const LOG_PREFIX = 'storyblok-stories-pull-';

const server = setupServer();
const preconditions = {
  canFetchRemoteStoryPages(storyPages: MockStory[][], params: StoriesQueryParams = {}) {
    server.use(
      http.get(
        'https://mapi.storyblok.com/v1/spaces/12345/stories',
        ({ request }) => {
          const url = new URL(request.url);
          const matchesAllParams = Object.entries(params).every(
            ([key, value]) => url.searchParams.get(key) === String(value),
          );

          const page = Number(url.searchParams.get('page') ?? 1);
          const perPage = storyPages.length > 1 ? storyPages[0].length : 100;
          const total = storyPages.flat().length;
          const stories = matchesAllParams ? storyPages[page - 1] : [];
          return HttpResponse.json(
            { stories },
            {
              headers: {
                'Total': String(total),
                'Per-Page': String(perPage),
              },
            },
          );
        },
      ),
    );
  },
  canFetchRemoteStories(stories: MockStory[]) {
    for (const story of stories) {
      server.use(http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${story.id}`, () => HttpResponse.json({
        story,
      })));
    }
  },
  failsToFetchRemoteStoryPages() {
    server.use(http.get('https://mapi.storyblok.com/v1/spaces/12345/stories', () => HttpResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    )));
  },
  failsToFetchRemoteStory(id: MockStory['id'], stories: MockStory[]) {
    this.canFetchRemoteStoryPages([stories]);
    this.canFetchRemoteStories(stories);
    server.use(http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${id}`, () => HttpResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    )));
  },
  failsToSaveStory() {
    const writeError = new Error('Simulated write failure') as NodeJS.ErrnoException;
    writeError.code = 'EACCES';
    writeError.syscall = 'write';
    vi.spyOn(fs, 'writeFile').mockRejectedValue(writeError);
  },
  canPullStories(
    storyPages: MockStory[][] = [[makeMockStory(), makeMockStory(), makeMockStory()]],
    params: StoriesQueryParams = {},
  ) {
    this.canFetchRemoteStoryPages(storyPages, params);
    this.canFetchRemoteStories(storyPages.flat());
  },
};

describe('stories pull command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });
  afterAll(() => server.close());

  it('should pull all stories', async () => {
    const storyPages = [[makeMockStory(), makeMockStory()], [makeMockStory()]];
    preconditions.canPullStories(storyPages);
    const stories = storyPages.flat();

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    expect(stories.every(storyFileExists)).toBeTruthy();
    // Report
    const reportFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('reports/12345/storyblok-stories-pull-'))?.[1];
    expect(JSON.parse(reportFile || '{}')).toEqual({
      status: 'SUCCESS',
      meta: {
        runId: expect.any(String),
        command: 'storyblok stories pull',
        cliVersion: expect.any(String),
        startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        endedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        durationMs: expect.any(Number),
        logPath: expect.any(String),
        config: expect.any(Object),
      },
      summary: {
        fetchStoryPagesResults: {
          failed: 0,
          succeeded: 2,
          total: 2,
        },
        fetchStoriesResults: {
          failed: 0,
          succeeded: 3,
          total: 3,
        },
        saveResults: {
          failed: 0,
          succeeded: 3,
          total: 3,
        },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Fetched stories page 1 of 2');
    expect(logFile).toContain('Fetched stories page 2 of 2');
    expect(logFile).toMatch(new RegExp(`Fetched story.*?"storyId":${stories[0].id}`));
    expect(logFile).toMatch(new RegExp(`Fetched story.*?"storyId":${stories[1].id}`));
    expect(logFile).toMatch(new RegExp(`Fetched story.*?"storyId":${stories[2].id}`));
    expect(logFile).toMatch(new RegExp(`Saved story.*?"storyId":${stories[0].id}`));
    expect(logFile).toMatch(new RegExp(`Saved story.*?"storyId":${stories[1].id}`));
    expect(logFile).toMatch(new RegExp(`Saved story.*?"storyId":${stories[2].id}`));
    expect(logFile).toContain('Pulling stories finished');
    expect(logFile).toContain('"fetchStoryPages":{"total":2,"succeeded":2,"failed":0}');
    expect(logFile).toContain('"fetchStories":{"total":3,"succeeded":3,"failed":0}');
    expect(logFile).toContain('"save":{"total":3,"succeeded":3,"failed":0}');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Pull results: 3 stories pulled, 0 stories failed'),
    );
  });

  it('should handle dry run mode correctly', async () => {
    const storyPages = [[makeMockStory(), makeMockStory()], [makeMockStory()]];
    preconditions.canPullStories(storyPages);
    const stories = storyPages.flat();

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--dry-run']);

    expect(stories.every(f => storyFileExists(f) === false)).toBeTruthy();
    // UI
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('DRY RUN MODE ENABLED: No changes will be made.'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Pull results: 3 stories pulled, 0 stories failed'),
    );
  });

  it('should only pull stories matching the given filters', async () => {
    const stories = [makeMockStory(), makeMockStory(), makeMockStory()];
    preconditions.canPullStories([stories], {
      filter_query: '[highlighted][in]=true',
      starts_with: '/en/blog/',
    });

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--query', '[highlighted][in]=true', '--starts-with', '/en/blog/']);

    expect(stories.every(storyFileExists)).toBeTruthy();
  });

  it('should handle file system write errors', async () => {
    const stories = [makeMockStory(), makeMockStory(), makeMockStory()];
    preconditions.canPullStories([stories]);
    preconditions.failsToSaveStory();

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Permission denied while accessing the file');
    expect(logFile).toContain('"fetchStoryPages":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"fetchStories":{"total":3,"succeeded":3,"failed":0}');
    expect(logFile).toContain('"save":{"total":3,"succeeded":0,"failed":3}');
    // UI
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied while accessing the file'),
      '',
    );
  });

  it('should handle error fetching the remote stories list', async () => {
    preconditions.failsToFetchRemoteStoryPages();

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(logFile).toContain('"fetchStoryPages":{"total":1,"succeeded":0,"failed":1}');
    expect(logFile).toContain('"fetchStories":{"total":0,"succeeded":0,"failed":0}');
    expect(logFile).toContain('"save":{"total":0,"succeeded":0,"failed":0}');
    // UI
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error fetching data from the API'),
      '',
    );
  });

  it('should handle error fetching a remote story', async () => {
    const stories = [makeMockStory(), makeMockStory(), makeMockStory()];
    preconditions.failsToFetchRemoteStory(stories[1].id, stories);

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(logFile).toContain('"fetchStoryPages":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"fetchStories":{"total":3,"succeeded":2,"failed":1}');
    expect(logFile).toContain('"save":{"total":2,"succeeded":2,"failed":0}');
    // UI
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error fetching data from the API'),
      '',
    );
  });
});
