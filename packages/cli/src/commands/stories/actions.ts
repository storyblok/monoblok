import type { StoryCreate, StoryUpdate } from "../../types";
import type {
  ExistingTargetStories,
  FetchStoriesResult,
  StoriesQueryParams,
  Story,
  TargetStoryRef,
} from "./constants";
import { normalizeFullSlug } from "./constants";
import { getMapiClient } from "../../api";
import { chunk, chunkByWeight } from "../../utils/array";
import { handleAPIError } from "../../utils/error/api-error";

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
  } catch (error) {
    handleAPIError("pull_stories", error as Error);
  }
};

export const fetchStory = async (
  spaceId: string,
  storyId: string | number,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Story | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.stories.get(Number(storyId), {
      path: {
        space_id: Number(spaceId),
      },
      signal,
      throwOnError: true,
    });

    return data.story;
  } catch (error) {
    handleAPIError("pull_story", error as Error);
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
  } catch (error) {
    handleAPIError("create_story", error);
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
): Promise<Story> => {
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
        force_update: payload.force_update === "1",
        ...(payload.publish ? { publish: Boolean(payload.publish) } : {}),
      },
      throwOnError: true,
    });

    const story = data?.story;
    if (!story) {
      throw new Error("Failed to update story");
    }

    return story;
  } catch (error) {
    if (error instanceof Error && error.message === "Failed to update story") {
      throw error;
    }
    handleAPIError("update_story", error);
  }
};

// Up to 100 keys per chunk: matches MAPI's `per_page=100` so id queries fill a
// page exactly (1 result per id) and slug queries paginate when folder +
// startpage pairs push the result count above one page.
const PREFETCH_CHUNK_SIZE = 100;
// The MAPI CDN rejects URLs above ~8 KB with a 414. Long slugs hit that before
// 100 entries; the ~2 KB left over covers the path and other query params.
const PREFETCH_MAX_ENCODED_SLUGS_LENGTH = 6000;
const ENCODED_SEPARATOR_LENGTH = encodeURIComponent(",").length;
const MAX_REPORTED_SLUG_LENGTH = 100;
const PREFETCH_PER_PAGE = 100;

const addRef = (result: ExistingTargetStories, story: Story): void => {
  const ref: TargetStoryRef = { id: story.id, uuid: story.uuid, is_folder: story.is_folder };
  if (story.full_slug) {
    const key = normalizeFullSlug(story.full_slug);
    const existing = result.bySlug.get(key);
    if (existing) {
      // Avoid duplicates if the same story comes back via both by_slugs and by_ids.
      if (!existing.some((r) => r.id === ref.id)) {
        existing.push(ref);
      }
    } else {
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
    const total = Number(response.headers.get("Total"));
    const perPage = Number(response.headers.get("Per-Page")) || PREFETCH_PER_PAGE;
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
 *
 * Throws before any request if a slug is too long to fit into a lookup URL.
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

  // `by_slugs` matches `full_slug` exactly, and a folder (`articles`) and its
  // start page (`articles/`) differ only by the trailing slash, so query with
  // unmodified slugs. Results are still keyed by the normalized slug.
  const slugSet = new Set<string>();
  for (const slug of keys.slugs) {
    if (slug) {
      slugSet.add(slug);
    }
  }
  const idSet = new Set<number>();
  for (const id of keys.ids) {
    if (typeof id === "number" && Number.isFinite(id)) {
      idSet.add(id);
    }
  }

  options?.onTotal?.(slugSet.size + idSet.size);

  const encodedSlugLength = (slug: string) =>
    encodeURIComponent(slug).length + ENCODED_SEPARATOR_LENGTH;
  const unmatchableSlugs = [...slugSet].filter(
    (slug) => encodedSlugLength(slug) > PREFETCH_MAX_ENCODED_SLUGS_LENGTH,
  );
  if (unmatchableSlugs.length > 0) {
    // Deep slugs share their leading folders, so the end identifies the story.
    const reportedSlugs = unmatchableSlugs.map((slug) => {
      const reportedSlug =
        slug.length > MAX_REPORTED_SLUG_LENGTH ? `…${slug.slice(-MAX_REPORTED_SLUG_LENGTH)}` : slug;
      return `  ${reportedSlug} (${encodedSlugLength(slug)} characters)`;
    });
    throw new Error(
      [
        `Full slugs longer than ${PREFETCH_MAX_ENCODED_SLUGS_LENGTH} URL-encoded characters can't be matched with existing stories in the target space. Shorten the slugs or nest the stories in fewer folders. Affected stories (${unmatchableSlugs.length}):`,
        ...reportedSlugs,
      ].join("\n"),
    );
  }

  if (slugSet.size === 0 && idSet.size === 0) {
    return result;
  }

  const slugChunks = chunkByWeight(slugSet, {
    maxSize: PREFETCH_CHUNK_SIZE,
    maxWeight: PREFETCH_MAX_ENCODED_SLUGS_LENGTH,
    weightOf: encodedSlugLength,
  });
  const idChunks = chunk(idSet, PREFETCH_CHUNK_SIZE);

  const requests: Array<Promise<void>> = [];

  for (const slugs of slugChunks) {
    requests.push(
      (async () => {
        await fetchChunkAllPages(spaceId, { by_slugs: slugs.join(",") }, (stories) => {
          for (const story of stories) {
            addRef(result, story);
          }
        });
        options?.onIncrement?.(slugs.length);
      })(),
    );
  }

  for (const ids of idChunks) {
    requests.push(
      (async () => {
        await fetchChunkAllPages(spaceId, { by_ids: ids.join(",") }, (stories) => {
          for (const story of stories) {
            addRef(result, story);
          }
        });
        options?.onIncrement?.(ids.length);
      })(),
    );
  }

  await Promise.all(requests);
  return result;
};
