import { randomUUID } from 'node:crypto';
import * as fsPromises from 'node:fs/promises';
import { join } from 'pathe';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
// Register the stories command and access the commander instance
import '../index';
import { storiesCommand } from '../command';
import { directories } from '../../../constants';
import { loadManifest, resolveCommandPath } from '../../../utils/filesystem';
import * as actions from '../actions';
import { resetReporter } from '../../../lib/reporter/reporter';
import { getProgram } from '../../../program';
import {
  DEFAULT_SPACE,
  getID,
  getLogFileContents,
  getReport as getReportHelper,
  makeMockComponent,
  type MockComponent,
} from '../../__tests__/helpers';
import { makeMockStory, type MockStory, randomThirdPartyID } from '../__tests__/helpers';

vi.spyOn(console, 'log');
vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

// memfs on Windows strips drive-letter prefixes (D:/a/… → /a/…),
// so we normalise resolved paths before comparing with vol.toJSON() keys.
const stripDriveLetter = (p: string) => p.replace(/^[a-z]:/i, '');

vi.spyOn(actions, 'createStory');
vi.spyOn(actions, 'updateStory');

const LOG_PREFIX = 'storyblok-stories-push-';

const parseManifest = async (space: string = DEFAULT_SPACE, basePath?: string) => {
  const manifestPath = join(resolveCommandPath(directories.stories, space, basePath), 'manifest.jsonl');
  return loadManifest(manifestPath);
};

const getReport = (space: string = DEFAULT_SPACE) => getReportHelper(LOG_PREFIX, space);

const server = setupServer(
  http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories/:storyId', () => HttpResponse.json(
    { message: 'Not Found' },
    { status: 404 },
  )),
  http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', () => HttpResponse.json(
    { stories: [] },
    { headers: { 'Total': '0', 'Per-Page': '100' } },
  )),
);

const preconditions = {
  canLoadComponents(components: MockComponent[], space = DEFAULT_SPACE, basePath?: string) {
    const componentsDir = resolveCommandPath(directories.components, space, basePath);
    vol.fromJSON(Object.fromEntries(components.map(c => [
      join(componentsDir, `${c.name}.json`),
      JSON.stringify(c),
    ])));
  },
  canLoadStories(stories: MockStory[], space = DEFAULT_SPACE, basePath?: string) {
    const storiesDir = resolveCommandPath(directories.stories, space, basePath);
    vol.fromJSON(Object.fromEntries(stories.map(s => [
      join(storiesDir, `${s.slug}_${s.uuid}.json`),
      JSON.stringify(s),
    ])));
  },
  failsToLoadStories(space = DEFAULT_SPACE, basePath?: string) {
    const storiesDir = resolveCommandPath(directories.stories, space, basePath);
    vol.fromJSON({
      [join(storiesDir, 'story-a.json')]: '{invalid json',
    });
  },
  canLoadManifest(manifestEntries: Record<number | string, number | string>[], space = DEFAULT_SPACE, basePath?: string) {
    const manifestPath = join(resolveCommandPath(directories.stories, space, basePath), 'manifest.jsonl');
    const content = `${manifestEntries.map(entry => JSON.stringify(entry)).join('\n')}\n`;
    vol.fromJSON({
      [manifestPath]: content,
    });
  },
  canLoadAssetManifest(manifestEntries: Record<string, unknown>[], space = DEFAULT_SPACE, basePath?: string) {
    const manifestPath = join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
    const content = `${manifestEntries.map(entry => JSON.stringify(entry)).join('\n')}\n`;
    vol.fromJSON({
      [manifestPath]: content,
    });
  },
  canCreateStories(stories: MockStory[], space = DEFAULT_SPACE) {
    const remoteStories = stories.map((s) => {
      return {
        ...s,
        id: getID(),
        uuid: randomUUID(),
      };
    });
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/stories`, async ({ request }) => {
        const body = await request.json() as { story: MockStory };
        const story = remoteStories.find(s => s.slug === body.story.slug);
        if (!story) {
          throw new Error('Can not find local story with matching slug!');
        }
        return HttpResponse.json({ story });
      }),
    );
    return remoteStories;
  },
  failsToCreateStories(space = DEFAULT_SPACE) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/stories`, () => {
        return HttpResponse.json({ message: 'Failed to create placeholder story' }, { status: 500 });
      }),
    );
  },
  canUpdateStories(stories: MockStory[], space = DEFAULT_SPACE) {
    for (const story of stories) {
      server.use(
        http.put(`https://mapi.storyblok.com/v1/spaces/${space}/stories/${story.id}`, () => {
          return HttpResponse.json({ story });
        }),
      );
    }
  },
  failsToUpdateStories(stories: MockStory[], space = DEFAULT_SPACE) {
    for (const story of stories) {
      server.use(
        http.put(`https://mapi.storyblok.com/v1/spaces/${space}/stories/${story.id}`, () => {
          return HttpResponse.json({ message: 'Failed to update story' }, { status: 500 });
        }),
      );
    }
  },
  canListStories(stories: MockStory[], space = DEFAULT_SPACE) {
    const perPage = 2;
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/stories`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') || '1');
        const start = (page - 1) * perPage;
        const pageStories = stories.slice(start, start + perPage);
        return HttpResponse.json(
          { stories: pageStories },
          { headers: { 'Total': String(stories.length), 'Per-Page': String(perPage) } },
        );
      }),
    );
  },
};

describe('stories push command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    getProgram().setOptionValueWithSource('path', undefined, 'default');
    resetReporter();
  });
  afterAll(() => server.close());

  describe('first-time push', () => {
    it('should push stories with mapped references', async () => {
      const storyB = makeMockStory({
        slug: 'story-b',
      });
      const storyC = makeMockStory({
        slug: 'story-c',
      });
      const storyD = makeMockStory({
        slug: 'story-d',
      });
      const storyE = makeMockStory({
        slug: 'story-e',
        is_folder: true,
      });
      const storyA = makeMockStory({
        slug: 'story-a',
        parent_id: storyE.id,
        content: {
          _uid: randomUUID(),
          component: 'page',
          richtext: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    marks: [
                      {
                        type: 'link',
                        attrs: {
                          href: storyB.slug,
                          uuid: storyB.uuid,
                          linktype: 'story',
                        },
                      },
                    ],
                    text: 'Link to story',
                  },
                ],
              },
            ],
          },
          link: {
            fieldtype: 'multilink',
            linktype: 'story',
            id: storyC.uuid,
            url: '',
            cached_url: 'home',
          },
          references: [storyD.uuid],
        },
      });
      const localStories = [storyA, storyB, storyC, storyD, storyE];
      preconditions.canLoadStories(localStories);
      const pageComponent = makeMockComponent({
        name: 'page',
        schema: {
          richtext: {
            type: 'richtext',
          },
          link: {
            type: 'multilink',
          },
          references: {
            type: 'options',
            source: 'internal_stories',
          },
        },
      });
      preconditions.canLoadComponents([pageComponent]);
      const remoteStories = preconditions.canCreateStories(localStories);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const [storyARemote, storyBRemote, storyCRemote, storyDRemote, storyERemote] = remoteStories;
      // Check if references were mapped correctly before updating the placeholder
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyARemote.id, expect.objectContaining({
        story: {
          ...storyARemote,
          parent_id: storyERemote.id,
          content: {
            ...storyARemote.content,
            richtext: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      marks: [
                        {
                          type: 'link',
                          attrs: {
                            href: storyBRemote.slug,
                            uuid: storyBRemote.uuid,
                            linktype: 'story',
                          },
                        },
                      ],
                      text: 'Link to story',
                    },
                  ],
                },
              ],
            },
            link: {
              ...storyARemote.content.link as Record<string, unknown>,
              id: storyCRemote.uuid,
            },
            references: [
              storyDRemote.uuid,
            ],
          },
        },
      }));
      // Manifest
      const manifestEntries = await parseManifest();
      expect(manifestEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({ old_id: storyA.uuid, new_id: storyARemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyB.uuid, new_id: storyBRemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyC.uuid, new_id: storyCRemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyD.uuid, new_id: storyDRemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyE.uuid, new_id: storyERemote.uuid, created_at: expect.any(String) }),
      ]));
      // Report
      const report = getReport();
      expect(report).toEqual({
        status: 'SUCCESS',
        meta: {
          runId: expect.any(String),
          command: 'storyblok stories push',
          cliVersion: expect.any(String),
          startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          endedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          durationMs: expect.any(Number),
          logPath: expect.any(String),
          config: expect.any(Object),
        },
        summary: {
          creationResults: {
            total: 5,
            succeeded: 5,
            skipped: 0,
            failed: 0,
          },
          processResults: {
            total: 5,
            succeeded: 5,
            failed: 0,
          },
          updateResults: {
            total: 5,
            succeeded: 5,
            failed: 0,
          },
        },
      });
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toMatch(new RegExp(`Created story.*?"storyId":"${storyARemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Created story.*?"storyId":"${storyBRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Created story.*?"storyId":"${storyCRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Created story.*?"storyId":"${storyDRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Processed story.*?"storyId":"${storyARemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Processed story.*?"storyId":"${storyBRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Processed story.*?"storyId":"${storyCRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Processed story.*?"storyId":"${storyDRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Updated story.*?"storyId":"${storyARemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Updated story.*?"storyId":"${storyBRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Updated story.*?"storyId":"${storyCRemote.uuid}"`));
      expect(logFile).toMatch(new RegExp(`Updated story.*?"storyId":"${storyDRemote.uuid}"`));
      expect(logFile).toContain('Pushing stories finished');
      expect(logFile).toContain('"creationResults":{"total":5,"succeeded":5,"skipped":0,"failed":0}');
      expect(logFile).toContain('"processResults":{"total":5,"succeeded":5,"failed":0}');
      expect(logFile).toContain('"updateResults":{"total":5,"succeeded":5,"failed":0}');
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 5 stories pushed, 0 stories failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 5/5 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 5/5 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 5/5 succeeded, 0 failed.'),
      );
    });

    it('should push stories with mapped asset references', async () => {
      const assetOldId = 123;
      const assetNewId = 456;
      const assetOldFilename = 'https://a.com/old.jpg';
      const assetNewFilename = 'https://b.com/new.jpg';
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          component: 'page',
          hero_image: {
            id: assetOldId,
            filename: assetOldFilename,
            fieldtype: 'asset',
          },
          gallery: [
            {
              id: assetOldId,
              filename: assetOldFilename,
              fieldtype: 'asset',
            },
          ],
        },
      });
      const localStories = [storyA];
      preconditions.canLoadStories(localStories);
      const pageComponent = makeMockComponent({
        name: 'page',
        schema: {
          hero_image: {
            type: 'asset',
          },
          gallery: {
            type: 'multiasset',
          },
        },
      });
      preconditions.canLoadComponents([pageComponent]);
      const remoteStories = preconditions.canCreateStories(localStories);
      preconditions.canUpdateStories(remoteStories);
      preconditions.canLoadAssetManifest([
        {
          old_id: assetOldId,
          new_id: assetNewId,
          old_filename: assetOldFilename,
          new_filename: assetNewFilename,
          created_at: new Date().toISOString(),
        },
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const [storyARemote] = remoteStories;
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyARemote.id, expect.objectContaining({
        story: {
          ...storyARemote,
          parent_id: 0,
          content: {
            ...storyARemote.content,
            hero_image: {
              id: assetNewId,
              filename: assetNewFilename,
              fieldtype: 'asset',
            },
            gallery: [
              {
                id: assetNewId,
                filename: assetNewFilename,
                fieldtype: 'asset',
              },
            ],
          },
        },
      }));
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 0 stories failed'),
      );
    });

    it('should push stories with mapped references from third-party CMS', async () => {
      const storyB = makeMockStory({
        id: randomThirdPartyID(),
        uuid: randomThirdPartyID(),
        slug: 'story-b',
      });
      const storyC = makeMockStory({
        id: randomThirdPartyID(),
        uuid: randomThirdPartyID(),
        slug: 'story-c',
      });
      const storyD = makeMockStory({
        id: randomThirdPartyID(),
        uuid: randomThirdPartyID(),
        slug: 'story-d',
      });
      const storyA = makeMockStory({
        id: randomThirdPartyID(),
        uuid: randomThirdPartyID(),
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          richtext: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    marks: [
                      {
                        type: 'link',
                        attrs: {
                          href: storyB.slug,
                          uuid: storyB.uuid,
                          linktype: 'story',
                        },
                      },
                    ],
                    text: 'Link to story',
                  },
                ],
              },
            ],
          },
          link: {
            fieldtype: 'multilink',
            linktype: 'story',
            id: storyC.uuid,
            url: '',
            cached_url: 'home',
          },
          references: [storyD.uuid],
        },
      });
      const localStories = [storyA, storyB, storyC, storyD];
      preconditions.canLoadStories(localStories);
      const pageComponent = makeMockComponent({
        name: 'page',
        schema: {
          richtext: {
            type: 'richtext',
          },
          link: {
            type: 'multilink',
          },
          references: {
            type: 'options',
            source: 'internal_stories',
          },
        },
      });
      preconditions.canLoadComponents([pageComponent]);
      const remoteStories = preconditions.canCreateStories(localStories);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const [storyARemote, storyBRemote, storyCRemote, storyDRemote] = remoteStories;
      // Check if references were mapped correctly before updating the placeholder
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyARemote.id, expect.objectContaining({
        story: {
          ...storyARemote,
          parent_id: 0,
          content: {
            ...storyARemote.content,
            richtext: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      marks: [
                        {
                          type: 'link',
                          attrs: {
                            href: storyBRemote.slug,
                            uuid: storyBRemote.uuid,
                            linktype: 'story',
                          },
                        },
                      ],
                      text: 'Link to story',
                    },
                  ],
                },
              ],
            },
            link: {
              ...storyARemote.content.link as Record<string, unknown>,
              id: storyCRemote.uuid,
            },
            references: [
              storyDRemote.uuid,
            ],
          },
        },
      }));
      // Manifest
      const manifestEntries = await parseManifest();
      expect(manifestEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({ old_id: storyA.uuid, new_id: storyARemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyB.uuid, new_id: storyBRemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyC.uuid, new_id: storyCRemote.uuid, created_at: expect.any(String) }),
        expect.objectContaining({ old_id: storyD.uuid, new_id: storyDRemote.uuid, created_at: expect.any(String) }),
      ]));
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 4 stories pushed, 0 stories failed'),
      );
    });

    it('should handle circular references between stories', async () => {
      const storyBUUID = randomUUID();
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          references: [storyBUUID],
        },
      });
      const storyB = makeMockStory({
        slug: 'story-b',
        uuid: storyBUUID,
        content: {
          _uid: randomUUID(),
          component: 'page',
          references: [storyA.uuid],
        },
      });
      const localStories = [storyA, storyB];
      preconditions.canLoadStories(localStories);
      const pageComponent = makeMockComponent({
        name: 'page',
        schema: {
          references: {
            type: 'options',
            source: 'internal_stories',
          },
        },
      });
      preconditions.canLoadComponents([pageComponent]);
      const remoteStories = preconditions.canCreateStories(localStories);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const [storyARemote, storyBRemote] = remoteStories;
      // Check if references were mapped correctly before updating the placeholder
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyARemote.id, expect.objectContaining({
        story: {
          ...storyARemote,
          parent_id: 0,
          content: {
            ...storyARemote.content,
            references: [
              storyBRemote.uuid,
            ],
          },
        },
      }));
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyBRemote.id, expect.objectContaining({
        story: {
          ...storyBRemote,
          parent_id: 0,
          content: {
            ...storyBRemote.content,
            references: [
              storyARemote.uuid,
            ],
          },
        },
      }));
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 2 stories pushed, 0 stories failed'),
      );
    });

    it('should push folders with missing content field', async () => {
      const folder = makeMockStory({
        slug: 'my-folder',
        is_folder: true,
        content: {} as any,
      });
      delete (folder as any).content;

      preconditions.canLoadStories([folder]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page' }),
      ]);
      const remoteStories = preconditions.canCreateStories([folder]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const report = getReport();
      expect(report?.status).toBe('SUCCESS');
      expect(report?.summary).toMatchObject({
        creationResults: { total: 1, succeeded: 1, failed: 0 },
      });
    });

    it('should send parent_id and is_startpage during creation when parent is resolved', async () => {
      const folder = makeMockStory({
        slug: 'lang-a',
        full_slug: 'lang-a',
        is_folder: true,
      });
      const startpage = makeMockStory({
        slug: 'home',
        full_slug: 'lang-a/home',
        parent_id: folder.id,
        is_startpage: true,
      });

      preconditions.canLoadStories([folder, startpage]);
      preconditions.canLoadComponents([makeMockComponent({ name: 'page' })]);
      const [remoteFolder, remoteStartpage] = preconditions.canCreateStories([folder, startpage]);
      preconditions.canUpdateStories([remoteFolder, remoteStartpage]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      // Folder creation: no parent_id, no is_startpage
      expect(actions.createStory).toHaveBeenCalledWith(
        DEFAULT_SPACE,
        expect.objectContaining({
          story: expect.objectContaining({ slug: 'lang-a', is_folder: true }),
        }),
      );
      const calls = (actions.createStory as ReturnType<typeof vi.fn>).mock.calls;
      const folderCall = calls.find((c: unknown[]) => (c[1] as { story: { slug: string } }).story.slug === 'lang-a')!;
      expect(folderCall[1].story).not.toHaveProperty('parent_id');
      expect(folderCall[1].story).not.toHaveProperty('is_startpage');

      // Startpage creation: parent_id points to the remote folder, is_startpage is true
      const startpageCall = calls.find((c: unknown[]) => (c[1] as { story: { slug: string } }).story.slug === 'home')!;
      expect(startpageCall[1].story.parent_id).toBe(remoteFolder.id);
      expect(startpageCall[1].story.is_startpage).toBe(true);
    });
  });

  describe('same-space push', () => {
    it('should update the existing story if a story with a matching UUID already exists', async () => {
      const storyA = makeMockStory({
        uuid: randomUUID(),
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canListStories([storyA]);
      const pageComponent = makeMockComponent({ name: 'page' });
      preconditions.canLoadComponents([pageComponent]);
      preconditions.canUpdateStories([storyA]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyA.id, expect.objectContaining({
        story: { ...storyA, parent_id: 0 },
      }));
      // Manifest
      const manifestEntries = await parseManifest();
      expect(manifestEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({ old_id: storyA.uuid, new_id: storyA.uuid, created_at: expect.any(String) }),
      ]));
      // Report
      const report = getReport();
      expect(report).toMatchObject(expect.objectContaining({
        status: 'SUCCESS',
        summary: {
          creationResults: {
            total: 1,
            succeeded: 0,
            skipped: 1,
            failed: 0,
          },
          processResults: {
            total: 1,
            succeeded: 1,
            failed: 0,
          },
          updateResults: {
            total: 1,
            succeeded: 1,
            failed: 0,
          },
        },
      }));
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toMatch(new RegExp(`Skipped creating story.*?"storyId":"${storyA.uuid}"`));
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 0 stories failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 1/1 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 1/1 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 1/1 succeeded, 0 failed.'),
      );
    });

    it('should create a new story when same-space slug matches but UUID differs', async () => {
      // Simulates: user pulled story, deleted it, created a different story at the same slug.
      const localStory = makeMockStory({
        slug: 'story-a',
        full_slug: 'story-a',
      });
      // Target space has a different story at the same slug (different UUID).
      const targetStory = makeMockStory({
        slug: 'story-a',
        full_slug: 'story-a',
      });

      preconditions.canLoadStories([localStory]);
      preconditions.canLoadComponents([makeMockComponent({ name: 'page' })]);
      preconditions.canListStories([targetStory]);
      const [createdStory] = preconditions.canCreateStories([localStory]);
      preconditions.canUpdateStories([createdStory]);

      // Same-space push (no --from flag)
      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      // UUID mismatch: story should be created, not matched by slug.
      expect(actions.createStory).toHaveBeenCalled();
    });
  });

  describe('cross-space push', () => {
    it('should enable users to sync stories to another space', async () => {
      const fromSpace = '54321';
      const targetSpace = DEFAULT_SPACE;
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA], fromSpace);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ], fromSpace);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', targetSpace, '--from', fromSpace]);

      const report = getReport();
      expect(report?.status).toBe('SUCCESS');
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 0 stories failed'),
      );
    });

    it('should match existing stories by full_slug in a duplicated space', async () => {
      const sourceSpace = '99999';
      const targetSpace = DEFAULT_SPACE;

      // Local stories from the source space (different IDs/UUIDs)
      const localFolder = makeMockStory({
        slug: 'folder-a',
        full_slug: 'folder-a',
        is_folder: true,
      });
      const localStory = makeMockStory({
        slug: 'story-a',
        full_slug: 'folder-a/story-a',
        parent_id: localFolder.id,
      });

      // Target space already has stories with the same slugs but different IDs/UUIDs
      const targetFolder = makeMockStory({
        slug: 'folder-a',
        full_slug: 'folder-a',
        is_folder: true,
      });
      const targetStory = makeMockStory({
        slug: 'story-a',
        full_slug: 'folder-a/story-a',
        parent_id: targetFolder.id,
      });

      preconditions.canLoadStories([localFolder, localStory], sourceSpace);
      preconditions.canLoadComponents([makeMockComponent({ name: 'page' })], sourceSpace);
      // The target space lists these stories (pre-fetch)
      preconditions.canListStories([targetFolder, targetStory], targetSpace);
      // Update endpoints for the target stories
      preconditions.canUpdateStories([targetFolder, targetStory], targetSpace);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', targetSpace, '--from', sourceSpace]);

      // Stories were matched by slug, not created
      expect(actions.createStory).not.toHaveBeenCalled();
      // Stories were updated with the target IDs
      expect(actions.updateStory).toHaveBeenCalledWith(targetSpace, targetFolder.id, expect.anything());
      expect(actions.updateStory).toHaveBeenCalledWith(targetSpace, targetStory.id, expect.objectContaining({
        story: expect.objectContaining({
          parent_id: targetFolder.id,
        }),
      }));
      // Manifest should map source → target
      const manifestEntries = await parseManifest(sourceSpace);
      expect(manifestEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({ old_id: localFolder.uuid, new_id: targetFolder.uuid }),
        expect.objectContaining({ old_id: localFolder.id, new_id: targetFolder.id }),
        expect.objectContaining({ old_id: localStory.uuid, new_id: targetStory.uuid }),
        expect.objectContaining({ old_id: localStory.id, new_id: targetStory.id }),
      ]));
      // Report
      const report = getReport(targetSpace);
      expect(report).toMatchObject(expect.objectContaining({
        status: 'SUCCESS',
        summary: {
          creationResults: {
            total: 2,
            succeeded: 0,
            skipped: 2,
            failed: 0,
          },
          processResults: {
            total: 2,
            succeeded: 2,
            failed: 0,
          },
          updateResults: {
            total: 2,
            succeeded: 2,
            failed: 0,
          },
        },
      }));
    });
  });

  describe('manifest resume', () => {
    it('should resume using an existing manifest entry and skip creation', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      preconditions.canCreateStories([storyA]);
      const [remoteStory] = preconditions.canCreateStories([storyA]);
      preconditions.canListStories([remoteStory]);
      preconditions.canUpdateStories([remoteStory]);
      const manifest = [
        {
          old_id: storyA.uuid,
          new_id: remoteStory.uuid,
          created_at: new Date().toISOString(),
        },
        {
          old_id: storyA.id,
          new_id: remoteStory.id,
          created_at: new Date().toISOString(),
        },
      ];
      preconditions.canLoadManifest(manifest);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      const manifestEntries = await parseManifest();
      expect(manifestEntries).toEqual(manifest);
      // Reporting
      const report = getReport();
      expect(report).toMatchObject(expect.objectContaining({
        status: 'SUCCESS',
        summary: {
          creationResults: {
            total: 1,
            succeeded: 0,
            skipped: 1,
            failed: 0,
          },
          processResults: {
            total: 1,
            succeeded: 1,
            failed: 0,
          },
          updateResults: {
            total: 1,
            succeeded: 1,
            failed: 0,
          },
        },
      }));
    });

    it('should not end up with duplicate entries in the manifest after multiple runs', async () => {
      const storyA = makeMockStory();
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([makeMockComponent({ name: 'page' })]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);
      // After the first push, the remote stories exist in the target space.
      preconditions.canListStories(remoteStories);
      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      // Two entries because one entry for the UUID and one for the numeric ID.
      expect(await parseManifest()).toHaveLength(2);
    });
  });

  describe('options', () => {
    it('should publish stories when the publish flag is provided', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--publish']);

      const [remoteStory] = remoteStories;
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, remoteStory.id, expect.objectContaining({
        publish: 1,
      }));
    });

    it('should read stories and components from a custom path', async () => {
      const customPath = 'custom-path';
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA], DEFAULT_SPACE, customPath);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ], DEFAULT_SPACE, customPath);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      const program = getProgram();
      program.setOptionValueWithSource('path', customPath, 'cli');
      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const [remoteStory] = remoteStories;
      expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, remoteStory.id, expect.anything());
      const manifestEntries = await parseManifest(DEFAULT_SPACE, customPath);
      expect(manifestEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({ old_id: storyA.uuid, new_id: remoteStory.uuid, created_at: expect.any(String) }),
      ]));
    });

    it('should not make any updates in dry run mode', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--dry-run']);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      expect(await parseManifest()).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN MODE ENABLED: No changes will be made.'),
      );
    });
  });

  describe('cleanup', () => {
    it('should delete local story files when cleanup is enabled', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          component: 'page',
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup']);

      const storiesDir = resolveCommandPath(directories.stories, DEFAULT_SPACE);
      const storyFilePath = join(storiesDir, `${storyA.slug}_${storyA.uuid}.json`);
      const files = Object.keys(vol.toJSON());
      expect(files).not.toContain(stripDriveLetter(storyFilePath));
    });

    it('should not delete local story files when dry-run is enabled', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          component: 'page',
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup', '--dry-run']);

      const storiesDir = resolveCommandPath(directories.stories, DEFAULT_SPACE);
      const storyFilePath = join(storiesDir, `${storyA.slug}_${storyA.uuid}.json`);
      const files = Object.keys(vol.toJSON());
      expect(files).toContain(stripDriveLetter(storyFilePath));
    });

    it('should only delete stories that were successfully pushed', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          component: 'page',
        },
      });
      const storyB = makeMockStory({
        slug: 'story-b',
        content: {
          component: 'page',
        },
      });
      preconditions.canLoadStories([storyA, storyB]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA, storyB]);
      // Only storyA will be updated successfully
      preconditions.canUpdateStories([remoteStories[0]]);
      preconditions.failsToUpdateStories([remoteStories[1]]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup']);

      const storiesDir = resolveCommandPath(directories.stories, DEFAULT_SPACE);
      const storyAFilePath = join(storiesDir, `${storyA.slug}_${storyA.uuid}.json`);
      const storyBFilePath = join(storiesDir, `${storyB.slug}_${storyB.uuid}.json`);
      const files = Object.keys(vol.toJSON());
      // storyA should be deleted (successful)
      expect(files).not.toContain(stripDriveLetter(storyAFilePath));
      // storyB should remain (failed)
      expect(files).toContain(stripDriveLetter(storyBFilePath));
    });
  });

  describe('error handling', () => {
    it('should log an error and stop when manifest loading fails', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const manifestPath = join(resolveCommandPath(directories.stories, DEFAULT_SPACE), 'manifest.jsonl');
      vol.fromJSON({
        [manifestPath]: 'not-json',
      });

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('Unexpected token');
    });

    it('should handle errors when writing to the manifest fails', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);
      const appendFileError = Object.assign(new Error('Manifest append failed'), { code: 'EACCES' });
      vi.spyOn(fsPromises, 'appendFile').mockRejectedValue(appendFileError);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const manifestEntries = await parseManifest();
      expect(manifestEntries).toEqual([]);
      // Reporting
      const report = getReport();
      expect(report?.status).toBe('FAILURE');
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('Permission denied while accessing the file');
      // UI — story identification
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Story failed:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`"story-a"`),
        expect.anything(),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed stories:'),
      );
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 1 story failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 0/1 succeeded, 1 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 0/0 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 0/0 succeeded, 0 failed.'),
      );
    });

    it('should show a helpful error when no components can be found', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          component: 'page',
        },
      });
      preconditions.canLoadStories([storyA]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No components found. Please run `storyblok components pull` to fetch the latest components.'),
        expect.anything(),
      );
      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
    });

    it('should abort with a hard error when a story references a missing component schema', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: { _uid: randomUUID(), component: 'page' },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'article' }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing component schemas:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('- page (in stories: story-a)'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('run `storyblok components pull` to sync them locally'),
        expect.anything(),
      );
      const report = getReport();
      expect(report?.status).toBe('FAILURE');
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('Schema validation failed');
    });

    it('should abort with a hard error when a story has a field not declared in the component schema', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          color: {
            _uid: randomUUID(),
            plugin: 'official-colorpicker',
            color: '#4c1130',
          },
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
          schema: { headline: { type: 'text' } },
        }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('- page.color (in stories: story-a)'),
        expect.anything(),
      );
      const report = getReport();
      expect(report?.status).toBe('FAILURE');
    });

    it('should report every drift field across multiple components in a single aggregated error', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          color: '#4c1130',
          extra_page_field: 'x',
        },
      });
      const storyB = makeMockStory({
        slug: 'story-b',
        content: {
          _uid: randomUUID(),
          component: 'article',
          orphan: 'y',
          leftover: 'z',
        },
      });
      preconditions.canLoadStories([storyA, storyB]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: {} }),
        makeMockComponent({ name: 'article', schema: {} }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      const errorCalls = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const message = errorCalls.map(call => call[0]).join('\n');
      expect(message).toContain('- article.leftover (in stories: story-b)');
      expect(message).toContain('- article.orphan (in stories: story-b)');
      expect(message).toContain('- page.color (in stories: story-a)');
      expect(message).toContain('- page.extra_page_field (in stories: story-a)');
    });

    it('should abort when a drift field lives inside a nested blok', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          body: [
            {
              _uid: randomUUID(),
              component: 'hero',
              title: 'Ok',
              bg_color: '#ff0000',
            },
          ],
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: { body: { type: 'bloks' } } }),
        makeMockComponent({ name: 'hero', schema: { title: { type: 'text' } } }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('- hero.bg_color (in stories: story-a)'),
        expect.anything(),
      );
    });

    it('should abort when a drift field lives inside a blok embedded in a richtext field', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          rt: {
            type: 'doc',
            content: [
              {
                type: 'blok',
                attrs: {
                  id: randomUUID(),
                  body: [
                    {
                      _uid: randomUUID(),
                      component: 'hero',
                      title: 'Ok',
                      undeclared: 42,
                    },
                  ],
                },
              },
            ],
          },
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: { rt: { type: 'richtext' } } }),
        makeMockComponent({ name: 'hero', schema: { title: { type: 'text' } } }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('- hero.undeclared (in stories: story-a)'),
        expect.anything(),
      );
    });

    it('should report both missing schemas and drift fields together', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          stray: 'x',
        },
      });
      const storyB = makeMockStory({
        slug: 'story-b',
        content: { _uid: randomUUID(), component: 'unknown_component' },
      });
      preconditions.canLoadStories([storyA, storyB]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: {} }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const errorCalls = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const message = errorCalls.map(call => call[0]).join('\n');
      expect(message).toContain('Missing component schemas:');
      expect(message).toContain('- unknown_component (in stories: story-b)');
      expect(message).toContain('- page.stray (in stories: story-a)');
    });

    it('should validate before dry-run and abort on drift', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: { _uid: randomUUID(), component: 'page', stray: 1 },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: {} }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--dry-run']);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('- page.stray (in stories: story-a)'),
        expect.anything(),
      );
    });

    it('should not delete local stories when validation fails even if --cleanup is passed', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: { _uid: randomUUID(), component: 'page', stray: 1 },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: {} }),
      ]);
      const storyFilePath = join(
        resolveCommandPath(directories.stories, DEFAULT_SPACE),
        `${storyA.slug}_${storyA.uuid}.json`,
      );

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup']);

      const files = vol.toJSON();
      const hasStoryFile = Object.keys(files).some(f => stripDriveLetter(f) === stripDriveLetter(storyFilePath));
      expect(hasStoryFile).toBe(true);
    });

    it('should emit a FAILURE report with failed creation counts when validation fails', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: { _uid: randomUUID(), component: 'page', stray: 1 },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page', schema: {} }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const report = getReport();
      expect(report?.status).toBe('FAILURE');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 0/1 succeeded, 1 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 0/0 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 0/0 succeeded, 0 failed.'),
      );
    });

    it('should proceed with the push when every content field is declared in its schema', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          headline: 'Hi',
          color: {
            _uid: randomUUID(),
            plugin: 'official-colorpicker',
            color: '#4c1130',
          },
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
          schema: {
            headline: { type: 'text' },
            color: { type: 'custom', field_type: 'official-colorpicker' },
          },
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      const report = getReport();
      expect(report?.status).toBe('SUCCESS');
    });

    it('should warn once per plugin name when story content carries a custom plugin payload', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          color: {
            _uid: randomUUID(),
            plugin: 'official-colorpicker',
            color: '#4c1130',
          },
          secondary_color: {
            _uid: randomUUID(),
            plugin: 'official-colorpicker',
            color: '#ffffff',
          },
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
          schema: {
            color: { type: 'custom', field_type: 'official-colorpicker' },
            secondary_color: { type: 'custom', field_type: 'official-colorpicker' },
          },
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const warnCalls = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(call => typeof call[0] === 'string' && call[0].includes('official-colorpicker'));
      expect(warnCalls).toHaveLength(1);
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('The custom plugin \\"official-colorpicker\\" may contain references that require manual updates.');
    });

    it('should warn about plugin content nested inside a bloks field', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          body: [
            {
              _uid: randomUUID(),
              component: 'hero',
              bg_color: {
                _uid: randomUUID(),
                plugin: 'official-colorpicker',
                color: '#aabbcc',
              },
            },
          ],
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
          schema: { body: { type: 'bloks' } },
        }),
        makeMockComponent({
          name: 'hero',
          schema: { bg_color: { type: 'custom', field_type: 'official-colorpicker' } },
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.canUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('The custom plugin "official-colorpicker" may contain references that require manual updates.'),
      );
    });

    it('should handle errors when reading local stories fails', async () => {
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      preconditions.failsToLoadStories();

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.createStory).not.toHaveBeenCalled();
      expect(actions.updateStory).not.toHaveBeenCalled();
      // Reporting
      const report = getReport();
      expect(report.status).toBe('FAILURE');
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain(
        'Expected property name or \'}\' in JSON at position 1',
      );
      // UI — story identification
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Story failed:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[story-a.json]'),
        expect.anything(),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed stories:'),
      );
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 1 story failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 0/1 succeeded, 1 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 0/0 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 0/0 succeeded, 0 failed.'),
      );
    });

    it('should handle errors when creating placeholder stories fails', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      preconditions.failsToCreateStories();
      preconditions.failsToUpdateStories([storyA]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      // Reporting
      const report = getReport();
      expect(report.status).toBe('FAILURE');
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('The server returned an error');
      // UI — story identification
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Story failed:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`"story-a"`),
        expect.anything(),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed stories:'),
      );
      // UI
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 1 story failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 0/1 succeeded, 1 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 0/0 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 0/0 succeeded, 0 failed.'),
      );
    });

    it('should handle errors when mapping references fails', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          _uid: randomUUID(),
          component: 'page',
          body: 'this-is-not-a-valid-blok-array',
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
          schema: {
            body: {
              type: 'bloks',
            },
          },
        }),
      ]);
      preconditions.canCreateStories([storyA]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      expect(actions.updateStory).not.toHaveBeenCalled();
      // Reporting
      const report = getReport();
      expect(report?.status).toBe('PARTIAL_SUCCESS');
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('Invalid bloks field: expected an array');
      // UI
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid bloks field: expected an array'),
        expect.anything(),
      );
      // UI — story identification
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Story failed:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`"story-a"`),
        expect.anything(),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed stories:'),
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 1 story failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 1/1 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 0/1 succeeded, 1 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 0/0 succeeded, 0 failed.'),
      );
    });

    it('should fail to push non-folder stories with missing content.component', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {} as any,
      });
      delete (storyA as any).content;

      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({ name: 'page' }),
      ]);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      const report = getReport();
      expect(report?.status).toBe('FAILURE');
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('is missing a content type (content.component)');
      // UI — story identification
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Story failed:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`"story-a"`),
        expect.anything(),
      );
    });

    it('should handle errors when updating stories fails', async () => {
      const storyA = makeMockStory({
        slug: 'story-a',
        content: {
          component: 'page',
        },
      });
      preconditions.canLoadStories([storyA]);
      preconditions.canLoadComponents([
        makeMockComponent({
          name: 'page',
        }),
      ]);
      const remoteStories = preconditions.canCreateStories([storyA]);
      preconditions.failsToUpdateStories(remoteStories);

      await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

      // Reporting
      const report = getReport();
      expect(report?.status).toBe('PARTIAL_SUCCESS');
      // Logging
      const logFile = getLogFileContents(LOG_PREFIX);
      expect(logFile).toContain('The server returned an error');
      // UI
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('The server returned an error'),
        expect.anything(),
      );
      // UI — story identification
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Story failed:'),
        expect.anything(),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`"story-a"`),
        expect.anything(),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed stories:'),
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Push results: 1 story pushed, 1 story failed'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating stories: 1/1 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing stories: 1/1 succeeded, 0 failed.'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating stories: 0/1 succeeded, 1 failed.'),
      );
    });
  });
});
