import { readFile, unlink } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'pathe';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import type { Component } from '@storyblok/management-api-client/resources/components';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { createStory, fetchStories, fetchStory, updateStory } from './actions';
import type { ExistingTargetStories, StoriesQueryParams, StoryIndexEntry, TargetStoryRef } from './constants';
import { normalizeFullSlug } from './constants';
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

export type AppendToManifestTransport = (entry: StoryIndexEntry, remoteStory: TargetStoryRef) => Promise<void>;

export const makeAppendToManifestFSTransport = ({ manifestFile }: {
  manifestFile: string;
}): AppendToManifestTransport => async (entry, remoteStory) => {
  const createdAt = new Date().toISOString();
  await appendToFile(manifestFile, JSON.stringify({
    old_id: entry.uuid,
    new_id: remoteStory.uuid,
    created_at: createdAt,
  }));
  await appendToFile(manifestFile, JSON.stringify({
    old_id: entry.id,
    new_id: remoteStory.id,
    created_at: createdAt,
  }));
};

export const scanLocalStoryIndex = async ({
  directoryPath,
  setTotalStories,
  onIncrement,
  onError,
}: {
  directoryPath: string;
  setTotalStories?: (total: number) => void;
  onIncrement?: () => void;
  onError?: (error: Error, filename: string) => void;
}): Promise<StoryIndexEntry[]> => {
  const files = (await readDirectory(directoryPath)).filter(f => extname(f) === '.json');
  setTotalStories?.(files.length);
  const entries: StoryIndexEntry[] = [];

  for (const file of files) {
    try {
      const filePath = join(directoryPath, file);
      const fileContent = await readFile(filePath, 'utf-8');
      const story = JSON.parse(fileContent) as Story;
      entries.push({
        filename: file,
        id: story.id,
        uuid: story.uuid ?? '',
        slug: story.slug ?? '',
        name: story.name ?? '',
        full_slug: story.full_slug ?? '',
        is_folder: story.is_folder ?? false,
        is_startpage: (story as Record<string, unknown>).is_startpage === true,
        parent_id: story.parent_id ?? null,
        component: story.content?.component,
      });
    }
    catch (maybeError) {
      onError?.(toError(maybeError), file);
    }
    finally {
      onIncrement?.();
    }
  }

  return entries;
};

export const groupStoriesByDepth = (entries: StoryIndexEntry[]): StoryIndexEntry[][] => {
  const depthMap = new Map<number, StoryIndexEntry[]>();

  for (const entry of entries) {
    const slug = normalizeFullSlug(entry.full_slug || '');
    const depth = slug === '' ? 0 : slug.split('/').length - 1;
    if (!depthMap.has(depth)) {
      depthMap.set(depth, []);
    }
    depthMap.get(depth)!.push(entry);
  }

  const maxDepth = depthMap.size > 0 ? Math.max(...depthMap.keys()) : 0;
  const levels: StoryIndexEntry[][] = [];

  for (let d = 0; d <= maxDepth; d++) {
    const level = depthMap.get(d);
    if (!level || level.length === 0) {
      continue;
    }
    // Folders first so that concurrent task ordering is deterministic
    // (parent-child correctness is guaranteed by the level-by-level iteration,
    // since a folder is always at a shallower depth than its children).
    level.sort((a, b) => {
      if (a.is_folder && !b.is_folder) {
        return -1;
      }
      if (!a.is_folder && b.is_folder) {
        return 1;
      }
      return 0;
    });
    levels.push(level);
  }

  return levels;
};

export const createStoriesForLevel = async ({
  level,
  spaceId,
  maps,
  existingTargetStories,
  claimedRemoteIds,
  isCrossSpace,
  dryRun,
  appendToManifest,
  onStorySuccess,
  onStorySkipped,
  onStoryError,
}: {
  level: StoryIndexEntry[];
  spaceId: string;
  maps: RefMaps;
  existingTargetStories: ExistingTargetStories;
  claimedRemoteIds: Set<number>;
  isCrossSpace: boolean;
  dryRun: boolean;
  appendToManifest: AppendToManifestTransport;
  onStorySuccess?: (entry: StoryIndexEntry, remoteStory: Story) => void;
  onStorySkipped?: (entry: StoryIndexEntry, remoteStory: TargetStoryRef) => void;
  onStoryError?: (error: Error, entry: StoryIndexEntry) => void;
}): Promise<void> => {
  const tasks: Promise<void>[] = [];

  for (const entry of level) {
    await apiConcurrencyLock.acquire();

    const task = (async () => {
      try {
        // Primary: check manifest mapping (from a previous push).
        const mappedStoryId = maps.stories?.get(entry.id);
        const mappedRemoteStory = mappedStoryId
          ? existingTargetStories.byId.get(Number(mappedStoryId))
          : undefined;
        if (mappedRemoteStory) {
          claimedRemoteIds.add(mappedRemoteStory.id);
          onStorySkipped?.(entry, mappedRemoteStory);
          return;
        }

        // Fallback: match by full_slug when no manifest entry exists (first push).
        // Only match if the remote story hasn't already been claimed by another
        // local entry (prevents mis-matching after slug swaps or renames).
        // A folder and its startpage share the same full_slug, so bySlug stores
        // an array of candidates. We prefer matching by is_folder to avoid
        // cross-mapping folders to startpages (which would break parent_id
        // resolution for children).
        const normalizedSlug = entry.full_slug ? normalizeFullSlug(entry.full_slug) : undefined;
        const slugCandidates = normalizedSlug
          ? existingTargetStories.bySlug.get(normalizedSlug)
          : undefined;
        if (slugCandidates) {
          const unclaimed = slugCandidates.filter(ref => !claimedRemoteIds.has(ref.id));
          const match = unclaimed.find(ref => ref.is_folder === entry.is_folder) ?? unclaimed[0];
          if (match) {
            const isMatchConfirmed = isCrossSpace || match.uuid === entry.uuid;
            if (isMatchConfirmed) {
              claimedRemoteIds.add(match.id);
              await appendToManifest(entry, match);
              onStorySkipped?.(entry, match);
              return;
            }
          }
        }

        if (!entry.is_folder && !entry.component) {
          throw new Error(`Story "${entry.slug}" is missing a content type (content.component). Every story must define a content field with a valid component.`);
        }

        // Resolve parent_id from the maps (parent was created in a previous level).
        const resolvedParentId = entry.parent_id != null
          ? maps.stories?.get(entry.parent_id)
          : undefined;

        if (dryRun) {
          const fakeRemote = { id: entry.id, uuid: entry.uuid } as Story;
          onStorySuccess?.(entry, fakeRemote);
          return;
        }

        const remoteStory = await createStory(spaceId, {
          story: {
            slug: entry.slug,
            name: entry.name,
            is_folder: entry.is_folder,
            ...(resolvedParentId != null ? { parent_id: Number(resolvedParentId) } : {}),
            ...(entry.is_startpage && resolvedParentId != null ? { is_startpage: true } : {}),
            ...(entry.component
              ? { content: { _uid: '', component: entry.component } }
              : {}),
          },
          publish: 0,
        });
        if (!remoteStory) {
          throw new Error('No response!');
        }

        await appendToManifest(entry, remoteStory);
        onStorySuccess?.(entry, remoteStory);
      }
      catch (maybeError) {
        onStoryError?.(toError(maybeError), entry);
      }
      finally {
        apiConcurrencyLock.release();
      }
    })();

    tasks.push(task);
  }

  await Promise.all(tasks);
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
}): CleanupStoryTransport => {
  // Pre-build reverse lookup (remoteUuid → localUuid) so each cleanup call
  // is O(1) instead of scanning the full map.
  const reverseUuidMap = new Map<string | number, string>();
  if (maps.stories) {
    for (const [key, value] of maps.stories.entries()) {
      if (typeof key === 'string') {
        reverseUuidMap.set(value, key);
      }
    }
  }

  return async (mappedStory: Story) => {
    const uuid = mappedStory.uuid ?? '';
    const originalUuid = reverseUuidMap.get(uuid) ?? uuid;
    const storyFilename = getStoryFilename({
      slug: mappedStory.slug,
      uuid: originalUuid,
    });
    const storyFilePath = resolve(directoryPath, storyFilename);
    await unlink(storyFilePath);
  };
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
