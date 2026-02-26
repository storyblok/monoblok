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
  canFetchStories(stories: MockStory[], space = DEFAULT_SPACE) {
    for (const story of stories) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/stories/${story.id}`, () => {
          return HttpResponse.json({ story });
        }),
      );
    }
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
};

describe('stories push command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
  });
  afterAll(() => server.close());

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

  it('should update the existing story if a story with a matching UUID already exists', async () => {
    const storyA = makeMockStory({
      uuid: randomUUID(),
      slug: 'story-a',
    });
    preconditions.canLoadStories([storyA]);
    preconditions.canFetchStories([storyA]);
    const pageComponent = makeMockComponent({ name: 'page' });
    preconditions.canLoadComponents([pageComponent]);
    preconditions.canUpdateStories([storyA]);

    await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createStory).not.toHaveBeenCalled();
    expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyA.id, expect.objectContaining({
      story: storyA,
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

  it('should warn the user that references in custom plugin fields can\'t be processed', async () => {
    const storyA = makeMockStory({
      uuid: randomUUID(),
      slug: 'story-a',
      content: {
        _uid: randomUUID(),
        component: 'page',
        plugin: {
          type: 'custom',
          field_type: 'my_custom_field',
        },
      },
    });
    preconditions.canLoadStories([storyA]);
    preconditions.canFetchStories([storyA]);
    const pageComponent = makeMockComponent({
      name: 'page',
      schema: {
        plugin: {
          type: 'custom',
          field_type: 'my_custom_field',
        },
      },
    });
    preconditions.canLoadComponents([pageComponent]);
    preconditions.canUpdateStories([storyA]);

    await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createStory).not.toHaveBeenCalled();
    expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, storyA.id, expect.objectContaining({
      story: storyA,
    }));
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toMatch(new RegExp(`The custom plugin \\\\"my_custom_field\\\\" may contain references that require manual updates.*?"storyId":"${storyA.uuid}"`));
    // UI
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('The custom plugin "my_custom_field" may contain references that require manual updates.'),
    );
  });

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

    await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--path', customPath]);

    const [remoteStory] = remoteStories;
    expect(actions.updateStory).toHaveBeenCalledWith(DEFAULT_SPACE, remoteStory.id, expect.anything());
    const manifestEntries = await parseManifest(DEFAULT_SPACE, customPath);
    expect(manifestEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ old_id: storyA.uuid, new_id: remoteStory.uuid, created_at: expect.any(String) }),
    ]));
  });

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
    preconditions.canFetchStories([remoteStory]);
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
    preconditions.canLoadComponents([makeMockComponent()]);
    const remoteStories = preconditions.canCreateStories([storyA]);
    preconditions.canFetchStories(remoteStories);
    preconditions.canUpdateStories(remoteStories);

    await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);
    await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    // Two entries because one entry for the UUID and one for the numeric ID.
    expect(await parseManifest()).toHaveLength(2);
  });

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

  it('should show a helpful warning when a component schema is missing', async () => {
    const storyA = makeMockStory({
      slug: 'story-a',
      content: {
        component: 'page',
      },
    });
    preconditions.canLoadStories([storyA]);
    preconditions.canLoadComponents([
      makeMockComponent({
        name: 'article',
      }),
    ]);
    const remoteStories = preconditions.canCreateStories([storyA]);
    preconditions.canUpdateStories(remoteStories);

    await storiesCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('The component "page" was not found. Please run `storyblok components pull` to fetch the latest components.'),
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
    expect(files).not.toContain(storyFilePath);
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
    expect(files).toContain(storyFilePath);
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
    expect(files).not.toContain(storyAFilePath);
    // storyB should remain (failed)
    expect(files).toContain(storyBFilePath);
  });
});
