import type { StoryCreate, StoryUpdate } from '../../types';
import type { ExistingTargetStories, FetchStoriesResult, StoriesQueryParams, Story, TargetStoryRef } from './constants';
import { normalizeFullSlug } from './constants';
import { getMapiClient } from '../../api';
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

    const { data } = await client.stories.get(storyId, {
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
        force_update: payload.force_update === '1' ? '1' : '0',
        ...(payload.publish ? { publish: payload.publish } : {}),
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

export const prefetchTargetStories = async (spaceId: string, options?: {
  onTotal?: (total: number) => void;
  onIncrement?: (count: number) => void;
}): Promise<ExistingTargetStories> => {
  const result: ExistingTargetStories = {
    bySlug: new Map(),
    byId: new Map(),
  };
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const response = await fetchStories(spaceId, { page, per_page: 100 });
    if (!response) {
      break;
    }
    const total = Number(response.headers.get('Total'));
    const perPage = Number(response.headers.get('Per-Page'));
    totalPages = Math.ceil(total / perPage);
    if (page === 1) {
      options?.onTotal?.(total);
    }
    for (const story of response.stories) {
      const ref: TargetStoryRef = { id: story.id, uuid: story.uuid, is_folder: story.is_folder };
      if (story.full_slug) {
        const key = normalizeFullSlug(story.full_slug);
        const existing = result.bySlug.get(key);
        if (existing) {
          existing.push(ref);
        }
        else {
          result.bySlug.set(key, [ref]);
        }
      }
      result.byId.set(story.id, ref);
    }
    options?.onIncrement?.(response.stories.length);
    page++;
  }
  return result;
};
