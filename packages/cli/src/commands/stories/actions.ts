import type { StoryCreate, StoryUpdate } from '../../types';
import type { ExistingTargetStories, FetchStoriesResult, StoriesQueryParams, Story, TargetStoryRef } from './constants';
import { normalizeFullSlug } from './constants';
import { getMapiClient } from '../../api';
import { chunk } from '../../utils/array';
import { handleAPIError } from '../../utils/error/api-error';

/**
 * Fetches a single page of stories from Storyblok Management API
 * @param spaceId - The space ID
 * @param params - Optional query parameters for filtering stories
 * @returns Promise with an array of stories and response headers or undefined if error occurs
 */
export const fetchStories = async (
  spaceId: string,
  params?: StoriesQueryParams,
): Promise<FetchStoriesResult | undefined> => {
  try {
    const client = getMapiClient();
    const { data, response } = await client.stories.list({
      path: {
        space_id: Number(spaceId),
      },
      query: {
        ...params,
        per_page: params?.per_page || 100,
        page: params?.page || 1,
      },
      throwOnError: true,
    });

    return {
      stories: data.stories || [],
      headers: response.headers,
    };
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
};

export const fetchStory = async (
  spaceId: string,
  storyId: string | number,
) => {
  try {
    const client = getMapiClient();

    const { data } = await client.stories.get(Number(storyId), {
      path: {
        space_id: Number(spaceId),
      },
      throwOnError: true,
    });

    return data.story;
  }
  catch (error) {
    handleAPIError('pull_story', error as Error);
  }
};

export const createStory = async (
  spaceId: string,
  payload: {
    story: StoryCreate;
    publish?: number;
  },
): Promise<Story | void> => {
  try {
    const client = getMapiClient();

    const { data } = await client.stories.create({
      path: {
        space_id: Number(spaceId),
      },
      body: {
        story: {
          ...payload.story,
          // StoryCreate2 expects `parent_id?: number`; normalize null → undefined.
          parent_id: payload.story.parent_id ?? undefined,
        },
        ...(payload.publish ? { publish: payload.publish } : {}),
      },
      throwOnError: true,
    });

    return data?.story;
  }
  catch (error) {
    handleAPIError('create_story', error);
  }
};

/**
 * Updates a story in Storyblok with new content
 * @param spaceId - The space ID
 * @param storyId - The ID of the story to update
 * @param payload - The payload containing story data and update options
 * @param payload.story - The story data to update
 * @param payload.force_update - Whether to force the update (optional)
 * @param payload.publish - Whether to publish the story (optional)
 * @returns Promise with the updated story
 */
export const updateStory = async (
  spaceId: string,
  storyId: number,
  payload: {
    story: StoryUpdate;
    force_update?: string;
    publish?: number;
  },
) => {
  try {
    const client = getMapiClient();
    const { data } = await client.stories.update(storyId, {
      path: {
        space_id: Number(spaceId),
      },
      body: {
        story: {
          ...payload.story,
          // StoryUpdate2 expects `parent_id?: number`; normalize null → undefined.
          parent_id: payload.story.parent_id ?? undefined,
        },
      },
      query: {
        force_update: payload.force_update === '1',
        ...(payload.publish ? { publish: Boolean(payload.publish) } : {}),
      },
      throwOnError: true,
    });

    const story = data?.story;
    if (!story) {
      throw new Error('Failed to update story');
    }

    return story;
  }
  catch (error) {
    if (error instanceof Error && error.message === 'Failed to update story') {
      throw error;
    }
    handleAPIError('update_story', error);
  }
};

// 100 keys per chunk: matches MAPI's `per_page=100` so id queries fill a page
// exactly (1 result per id) and slug queries paginate when folder + startpage
// pairs push the result count above one page. At ~30 char slugs, 100 entries
// ≈ 3 KB — well below typical URL length limits.
const PREFETCH_CHUNK_SIZE = 100;
const PREFETCH_PER_PAGE = 100;

const addRef = (result: ExistingTargetStories, story: Story): void => {
  const ref: TargetStoryRef = { id: story.id, uuid: story.uuid, is_folder: story.is_folder };
  if (story.full_slug) {
    const key = normalizeFullSlug(story.full_slug);
    const existing = result.bySlug.get(key);
    if (existing) {
      // Avoid duplicates if the same story comes back via both by_slugs and by_ids.
      if (!existing.some(r => r.id === ref.id)) {
        existing.push(ref);
      }
    }
    else {
      result.bySlug.set(key, [ref]);
    }
  }
  result.byId.set(story.id, ref);
};

/**
 * Fetches every page of a single chunk query (`by_slugs` / `by_ids`).
 * A 100-id chunk returns ≤100 stories and resolves in one page; a 100-slug
 * chunk may exceed 100 results when slugs match folder + startpage pairs.
 */
const fetchChunkAllPages = async (
  spaceId: string,
  params: StoriesQueryParams,
  onPageStories: (stories: Story[]) => void,
): Promise<void> => {
  let page = 1;
  while (true) {
    const response = await fetchStories(spaceId, { ...params, page, per_page: PREFETCH_PER_PAGE });
    if (!response) {
      return;
    }
    onPageStories(response.stories);
    const total = Number(response.headers.get('Total'));
    const perPage = Number(response.headers.get('Per-Page')) || PREFETCH_PER_PAGE;
    if (!Number.isFinite(total) || total <= page * perPage) {
      return;
    }
    page++;
  }
};

/**
 * Targeted prefetch: fetches only the remote stories that match the local push set,
 * either by `full_slug` (cross-space duplicate matching, same-space slug fallback)
 * or by numeric id (resume against a same-space manifest).
 *
 * Slug and id batches are dispatched concurrently through the MAPI client's
 * existing throttle (default 6 requests per second, auto-retries 429).
 */
export const prefetchTargetStoriesByKeys = async (
  spaceId: string,
  keys: { slugs: Iterable<string>; ids: Iterable<number> },
  options?: {
    onTotal?: (total: number) => void;
    onIncrement?: (count: number) => void;
  },
): Promise<ExistingTargetStories> => {
  const result: ExistingTargetStories = {
    bySlug: new Map(),
    byId: new Map(),
  };

  const slugSet = new Set<string>();
  for (const slug of keys.slugs) {
    if (slug) {
      slugSet.add(normalizeFullSlug(slug));
    }
  }
  const idSet = new Set<number>();
  for (const id of keys.ids) {
    if (typeof id === 'number' && Number.isFinite(id)) {
      idSet.add(id);
    }
  }

  options?.onTotal?.(slugSet.size + idSet.size);

  if (slugSet.size === 0 && idSet.size === 0) {
    return result;
  }

  const slugChunks = chunk(slugSet, PREFETCH_CHUNK_SIZE);
  const idChunks = chunk(idSet, PREFETCH_CHUNK_SIZE);

  const requests: Array<Promise<void>> = [];

  for (const slugs of slugChunks) {
    requests.push((async () => {
      await fetchChunkAllPages(spaceId, { by_slugs: slugs.join(',') }, (stories) => {
        for (const story of stories) {
          addRef(result, story);
        }
      });
      options?.onIncrement?.(slugs.length);
    })());
  }

  for (const ids of idChunks) {
    requests.push((async () => {
      await fetchChunkAllPages(spaceId, { by_ids: ids.join(',') }, (stories) => {
        for (const story of stories) {
          addRef(result, story);
        }
      });
      options?.onIncrement?.(ids.length);
    })());
  }

  await Promise.all(requests);
  return result;
};
