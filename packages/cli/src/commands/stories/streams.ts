import { readFile, unlink } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'pathe';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import type { Component } from '@storyblok/management-api-client/resources/components';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { createStory, fetchStories, fetchStory, updateStory } from './actions';
import type { StoriesQueryParams } from './constants';
import { appendToFile, readDirectory, saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils/error/error';
import { type ComponentSchemas, type RefMaps, storyRefMapper } from './ref-mapper';
import { getStoryFilename, isStoryPublishedWithoutChanges } from './utils';

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

export type CreateStoryTransport = (story: Story) => Promise<Story>;

export const makeCreateStoryAPITransport = ({ spaceId }: {
  spaceId: string;
}): CreateStoryTransport => async (localStory) => {
  // Exclude parent_id from the creation payload. The correct parent_id is set in Pass 2 when the full ID map is available.
  // This avoids 422 errors from the API.
  const { id: _id, uuid: _uuid, parent_id: _parentId, content, ...newStoryData } = localStory;

  if (!localStory.is_folder && !content?.component) {
    throw new Error(`Story "${localStory.slug}" is missing a content type (content.component). Every story must define a content field with a valid component.`);
  }

  const remoteStory = await createStory(spaceId, {
    story: {
      ...newStoryData,
      ...(content?.component
        ? { content: { _uid: '', component: '__migration_artifact__' } }
        : {}),
    },
    publish: 0,
  });
  if (!remoteStory) {
    throw new Error('No response!');
  }

  return remoteStory;
};

export type AppendToManifestTransport = (localStory: Story, remoteStory: TargetStoryRef) => Promise<void>;

export const makeAppendToManifestFSTransport = ({ manifestFile }: {
  manifestFile: string;
}): AppendToManifestTransport => async (localStory, remoteStory) => {
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
};

export type TargetStoryRef = Pick<Story, 'id' | 'uuid'>;

export interface ExistingTargetStories {
  bySlug: Map<string, TargetStoryRef>;
  byId: Map<number, TargetStoryRef>;
}

export const createStoryPlaceholderStream = ({
  maps,
  existingTargetStories,
  isCrossSpace,
  transports,
  onIncrement,
  onStorySuccess,
  onStorySkipped,
  onStoryError,
}: {
  maps: RefMaps;
  existingTargetStories: ExistingTargetStories;
  isCrossSpace: boolean;
  transports: {
    createStory: CreateStoryTransport;
    appendStoryManifest: AppendToManifestTransport;
  };
  onIncrement?: () => void;
  onStorySuccess?: (localStory: Story, remoteStory: Story) => void;
  onStorySkipped?: (localStory: Story, remoteStory: TargetStoryRef) => void;
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
          const mappedRemoteStory = mappedStoryId
            ? existingTargetStories.byId.get(Number(mappedStoryId))
            : undefined;
          if (mappedRemoteStory) {
            onStorySkipped?.(localStory, mappedRemoteStory);
            return;
          }

          // Match by full_slug: handles both same-space pushes and cross-space
          // pushes (duplicated spaces with different IDs but same slugs).
          const existingBySlug = localStory.full_slug
            ? existingTargetStories.bySlug.get(localStory.full_slug)
            : undefined;
          if (existingBySlug) {
            // Same-space: verify UUID to avoid binding to an unrelated story that
            // was recreated at the same slug between pull and push.
            // Cross-space: UUIDs always differ, so we can only match by slug.
            const isMatchConfirmed = isCrossSpace || existingBySlug.uuid === localStory.uuid;
            if (isMatchConfirmed) {
              await transports.appendStoryManifest(localStory, existingBySlug);
              onStorySkipped?.(localStory, existingBySlug);
              return;
            }
          }

          const newRemoteStory = await transports.createStory(localStory);
          await transports.appendStoryManifest(localStory, newRemoteStory);
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

export type WriteStoryTransport = (story: Story) => Promise<Story>;

export const makeWriteStoryFSTransport = ({ directoryPath }: {
  directoryPath: string;
}): WriteStoryTransport => async (story) => {
  await saveToFile(resolve(directoryPath, getStoryFilename(story)), JSON.stringify(story, null, 2));
  return story;
};

export const makeWriteStoryAPITransport = ({ spaceId, publish }: {
  spaceId: string;
  publish?: number;
}): WriteStoryTransport => mappedLocalStory => updateStory(spaceId, mappedLocalStory.id, {
  story: mappedLocalStory,
  publish: publish ?? (isStoryPublishedWithoutChanges(mappedLocalStory) ? 1 : 0),
});

export type CleanupStoryTransport = (mappedStory: Story) => Promise<void>;

export const makeCleanupStoryFSTransport = ({ directoryPath, maps }: {
  directoryPath: string;
  maps: RefMaps;
}): CleanupStoryTransport => async (mappedStory: Story) => {
  const mapEntry = maps.stories?.entries().find(([_, v]) => v === mappedStory.uuid);
  const originalUuid = mapEntry?.[0] && typeof mapEntry?.[0] === 'string' ? mapEntry?.[0] : mappedStory.uuid;
  const storyFilename = getStoryFilename({
    slug: mappedStory.slug,
    uuid: originalUuid,
  });
  const storyFilePath = resolve(directoryPath, storyFilename);
  await unlink(storyFilePath);
};

export const writeStoryStream = ({
  transports,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  transports: {
    writeStory: WriteStoryTransport;
    cleanupStory?: CleanupStoryTransport;
  };
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
          const remoteStory = await transports.writeStory(mappedLocalStory);
          await transports.cleanupStory?.(remoteStory);

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
