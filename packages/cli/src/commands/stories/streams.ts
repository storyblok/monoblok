import { readFile, unlink } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import type { Component } from '@storyblok/management-api-client/resources/components';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { createStory, fetchStories, fetchStory, updateStory } from './actions';
import type { StoriesQueryParams } from './constants';
import { appendToFile, readDirectory, saveToFile } from '../../utils/filesystem';
import { handleAPIError } from '../../utils/error/api-error';
import { toError } from '../../utils/error/error';
import { FetchError } from '../../utils/fetch';
import { type ComponentSchemas, type RefMaps, storyRefMapper } from './ref-mapper';
import { mapiClient } from '../../api';
import { getStoryFilename } from './utils';

const apiConcurrencyLock = new Sema(12);

export const fetchStoriesStream = ({
  spaceId,
  params = {},
  setTotalStories,
  setTotalPages,
  onIncrement,
  onPageSuccess,
  onPageError,
}: {
  spaceId: string;
  params?: StoriesQueryParams;
  setTotalStories?: (total: number) => void;
  setTotalPages?: (totalPages: number) => void;
  onIncrement?: () => void;
  onPageSuccess?: (page: number, total: number) => void;
  onPageError?: (error: Error, page: number, total: number) => void;
}) => {
  const listGenerator = async function* storyListIterator() {
    let perPage = 100;
    let page = 1;
    let totalPages = 1;
    // Set a default for total pages in case the first request fails.
    setTotalPages?.(totalPages);

    while (page <= totalPages) {
      try {
        const result = await fetchStories(spaceId, {
          ...params,
          per_page: perPage,
          page,
        });

        if (!result) {
          break;
        }

        const { headers } = result;
        const total = Number(headers.get('Total'));
        perPage = Number(headers.get('Per-Page'));
        totalPages = Math.ceil(total / perPage);
        setTotalStories?.(total);
        setTotalPages?.(totalPages);
        onPageSuccess?.(page, totalPages);

        for (const story of result.stories) {
          yield story;
        }

        page += 1;
      }
      catch (maybeError) {
        onPageError?.(toError(maybeError), page, totalPages);
        break;
      }
      finally {
        onIncrement?.();
      }
    }
  };

  return Readable.from(listGenerator());
};

export const fetchStoryStream = ({
  spaceId,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  spaceId: string;
  onIncrement?: () => void;
  onStorySuccess?: (story: Story) => void;
  onStoryError?: (error: Error, story: Story) => void;
}) => {
  const processing = new Set<Promise<void>>();

  return new Transform({
    objectMode: true,
    async transform(listStory: Story, _encoding, callback) {
      // Wait for a slot
      await apiConcurrencyLock.acquire();

      const task = fetchStory(spaceId, listStory.id.toString())
        .then((story) => {
          if (typeof story === 'undefined') {
            throw new TypeError('Invalid story!');
          }
          onStorySuccess?.(story);
          this.push(story);
        })
        .catch((maybeError) => {
          onStoryError?.(toError(maybeError), listStory);
        })
        .finally(() => {
          onIncrement?.();
          apiConcurrencyLock.release();
          processing.delete(task);
        });
      processing.add(task);

      // Call callback immediately to allow the stream to process the next chunk
      // (The `readLock` prevents us from reading too fast)
      callback();
    },
    // Ensure all pending requests finish before closing the stream
    flush(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};

const getUUIDFromFilename = (filename: string) => {
  const uuid = basename(filename, extname(filename)).split('_').at(-1);
  if (!uuid) {
    throw new Error(`Unable to extract UUID from local story "${filename}"`);
  }
  return uuid;
};

export const readLocalStoriesStream = ({
  directoryPath,
  fileFilter = () => true,
  setTotalStories,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  directoryPath: string;
  fileFilter?: (options: { uuid: string }) => boolean;
  setTotalStories?: (total: number) => void;
  onIncrement?: () => void;
  onStorySuccess?: (story: Story) => void;
  onStoryError?: (error: Error, filename: string) => void;
}) => {
  const listGenerator = async function* localStoryIterator() {
    const files = (await readDirectory(directoryPath))
      .filter(f => extname(f) === '.json' && fileFilter({ uuid: getUUIDFromFilename(f) }));
    setTotalStories?.(files.length);

    for (const file of files) {
      try {
        const filePath = join(directoryPath, file);
        const fileContent = await readFile(filePath, 'utf-8');
        const story = JSON.parse(fileContent) as Story;

        onStorySuccess?.(story);
        yield story;
      }
      catch (maybeError) {
        onStoryError?.(toError(maybeError), file);
      }
      finally {
        onIncrement?.();
      }
    }
  };

  return Readable.from(listGenerator());
};

export const mapReferencesStream = ({
  schemas,
  maps,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  schemas: ComponentSchemas;
  maps: RefMaps;
  onIncrement?: () => void;
  onStorySuccess?: (localStory: Story, processedFields: Set<Component['schema']>, missingSchemas: Set<Component['name']>) => void;
  onStoryError?: (error: Error, story: Story) => void;
}) => {
  return new Transform({
    objectMode: true,
    transform(localStory: Story, _encoding, callback) {
      try {
        const { mappedStory, processedFields, missingSchemas } = storyRefMapper(localStory, { schemas, maps });
        // @ts-expect-error Our types are wrong.
        onStorySuccess?.(mappedStory, processedFields, missingSchemas);
        this.push(mappedStory);
      }
      catch (maybeError) {
        onStoryError?.(toError(maybeError), localStory);
      }
      finally {
        onIncrement?.();
        callback();
      }
    },
  });
};

const getRemoteStory = async ({ spaceId, storyId }: {
  spaceId: string;
  storyId: number;
}) => {
  const { data, response } = await mapiClient().stories.get({
    path: {
      space_id: spaceId,
      story_id: storyId,
    },
  });

  if (!response.ok && response.status !== 404) {
    handleAPIError('pull_story', new FetchError(response.statusText, response));
  }

  if (data?.story?.deleted_at) {
    return undefined;
  }

  return data?.story;
};

export interface CreateStoryTransport {
  create: (story: Story) => Promise<Story>;
}

export const makeCreateStoryAPITransport = ({ spaceId }: {
  maps: RefMaps;
  spaceId: string;
}): CreateStoryTransport => ({
  create: async (localStory) => {
    const { id: _id, uuid: _uuid, content, parent_id: _p, ...newStoryData } = localStory;
    const remoteStory = await createStory(spaceId, {
      story: {
        ...newStoryData,
        content: {
          // @ts-expect-error Our types are wrong.
          component: content?.component,
        },
      },
      publish: 0,
    });
    if (!remoteStory) {
      throw new Error('No response!');
    }

    return remoteStory;
  },
});

export interface AppendToManifestTransport {
  append: (localStory: Story, remoteStory: Story) => Promise<void>;
}

export const makeAppendToManifestFSTransport = ({ manifestFile }: {
  manifestFile: string;
}): AppendToManifestTransport => ({
  append: async (localStory, remoteStory) => {
    const createdAt = new Date().toISOString();
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localStory.uuid,
      new_id: remoteStory.uuid,
      created_at: createdAt,
    }));
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localStory.id,
      new_id: remoteStory.id,
      created_at: createdAt,
    }));
  },
});

export const createStoryPlaceholderStream = ({
  maps,
  spaceId,
  storyTransport,
  manifestTransport,
  onIncrement,
  onStorySuccess,
  onStorySkipped,
  onStoryError,
}: {
  maps: RefMaps;
  spaceId: string;
  storyTransport: CreateStoryTransport;
  manifestTransport: AppendToManifestTransport;
  onIncrement?: () => void;
  onStorySuccess?: (localStory: Story, remoteStory: Story) => void;
  onStorySkipped?: (localStory: Story, remoteStory: Story) => void;
  onStoryError?: (error: Error, story: Story) => void;
}) => {
  const processing = new Set<Promise<void>>();

  return new Writable({
    objectMode: true,
    async write(localStory: Story, _encoding, callback) {
      await apiConcurrencyLock.acquire();

      const task = (async () => {
        try {
          // If a mapped remote story already exists, we must not create a new placeholder.
          // This can happen when the user resumes a failed push or runs push multiple times.
          const mappedStoryId = maps.stories?.get(localStory.id);
          const mappedRemoteStory = mappedStoryId && await getRemoteStory({ spaceId, storyId: Number(mappedStoryId) });
          // We check the UUID to make sure it is the exact same story and not just a
          // story with the same numeric ID in a different space.
          if (mappedRemoteStory) {
            onStorySkipped?.(localStory, mappedRemoteStory);
            // The story was already mapped so we can stop here.
            return;
          }

          // A user might want to push to the same space they pulled from. In this
          // case, we don't want to create a new placeholder story.
          const existingRemoteStory = await getRemoteStory({ spaceId, storyId: localStory.id });
          // We check the UUID to make sure it is the exact same story and not just a
          // story with the same numeric ID in a different space.
          if (existingRemoteStory && existingRemoteStory.uuid === localStory.uuid) {
            await manifestTransport.append(localStory, existingRemoteStory);
            onStorySkipped?.(localStory, existingRemoteStory);
            return;
          }

          const newRemoteStory = await storyTransport.create(localStory);
          await manifestTransport.append(localStory, newRemoteStory);
          onStorySuccess?.(localStory, newRemoteStory);
        }
        catch (maybeError) {
          onStoryError?.(toError(maybeError), localStory);
        }
      })();

      processing.add(task);
      task.finally(() => {
        onIncrement?.();
        apiConcurrencyLock.release();
        processing.delete(task);
      });

      callback();
    },
    final(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};

export interface WriteStoryTransport {
  write: (story: Story) => Promise<Story>;
}

export const makeWriteStoryFSTransport = ({ directoryPath }: {
  directoryPath: string;
}): WriteStoryTransport => ({
  write: async (story) => {
    await saveToFile(resolve(directoryPath, getStoryFilename(story)), JSON.stringify(story, null, 2));
    return story;
  },
});

export const makeWriteStoryAPITransport = ({ spaceId, publish }: {
  spaceId: string;
  publish?: number;
}) => ({
  write: (mappedLocalStory: Story) => updateStory(spaceId, mappedLocalStory.id, {
    story: mappedLocalStory,
    publish: publish ?? (mappedLocalStory.published ? 1 : 0),
  }),
});

export interface CleanupStoryTransport {
  cleanup: (mappedStory: Story) => Promise<void>;
}

export const makeCleanupStoryFSTransport = ({ directoryPath, maps }: {
  directoryPath: string;
  maps: RefMaps;
}): CleanupStoryTransport => ({
  cleanup: async (mappedStory: Story) => {
    const mapEntry = maps.stories?.entries().find(([_, v]) => v === mappedStory.uuid);
    const originalUuid = mapEntry?.[0] && typeof mapEntry?.[0] === 'string' ? mapEntry?.[0] : mappedStory.uuid;
    const storyFilename = getStoryFilename({
      slug: mappedStory.slug,
      uuid: originalUuid,
    });
    const storyFilePath = resolve(directoryPath, storyFilename);
    await unlink(storyFilePath);
  },
});

export const writeStoryStream = ({
  writeTransport,
  cleanupTransport,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  writeTransport: WriteStoryTransport;
  cleanupTransport?: CleanupStoryTransport;
  onIncrement?: () => void;
  onStorySuccess?: (mappedLocalStory: Story, remoteStory: Story) => void;
  onStoryError?: (error: Error, story: Story) => void;
}) => {
  const processing = new Set<Promise<void>>();

  return new Writable({
    objectMode: true,
    async write(mappedLocalStory: Story, _encoding, callback) {
      await apiConcurrencyLock.acquire();

      const task = (async () => {
        try {
          const remoteStory = await writeTransport.write(mappedLocalStory);
          await cleanupTransport?.cleanup(remoteStory);

          onStorySuccess?.(mappedLocalStory, remoteStory);
        }
        catch (maybeError) {
          onStoryError?.(toError(maybeError), mappedLocalStory);
        }
      })();

      processing.add(task);
      task.finally(() => {
        onIncrement?.();
        apiConcurrencyLock.release();
        processing.delete(task);
      });

      callback();
    },
    final(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};
