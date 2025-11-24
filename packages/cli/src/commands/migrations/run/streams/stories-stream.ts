import { pipeline, Readable, Transform } from 'node:stream';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { Sema } from 'async-sema';
import { fetchStories, fetchStory } from '../../../stories/actions';
import type { StoriesQueryParams } from '../../../stories/constants';
import { handleAPIError, toError } from '../../../../utils/error';
import { getLogger } from '../../../../utils/logger';
import { ERROR_CODES } from '../constants';

/**
 * Iterator that fetches stories
 */
export async function* storiesIterator(
  spaceId: string,
  params?: StoriesQueryParams,
  onTotal?: (total: number) => void,
) {
  try {
    let perPage = 500;

    // Apply the same parameter transformations as fetchAllStoriesByComponent
    const transformedParams: StoriesQueryParams = {
      ...params,
    };

    // Handle component filter - convert componentName to contain_component
    if (params?.componentName && typeof params.componentName === 'string') {
      transformedParams.contain_component = params.componentName;
      delete transformedParams.componentName;
    }

    // Handle query string if provided - add filter_query prefix
    if (params?.query && typeof params.query === 'string') {
      transformedParams.filter_query = params.query.startsWith('filter_query')
        ? params.query
        : `filter_query${params.query}`;
      delete transformedParams.query;
    }

    // Fetch first page to get total pages
    const result = await fetchStories(spaceId, {
      ...transformedParams,
      per_page: perPage,
      page: 1,
      story_only: true,
    });
    getLogger().info(`Fetched stories page 1 of ${perPage}`);

    if (!result) {
      return;
    }

    const { headers } = result;
    const total = Number(headers.get('Total'));
    perPage = Number(headers.get('Per-Page'));
    const totalPages = Math.ceil(Number(total) / perPage);

    if (onTotal) {
      onTotal(total);
    }

    for (let page = 1; page <= totalPages; page++) {
      const result = await fetchStories(spaceId, {
        ...transformedParams,
        per_page: perPage,
        page,
        story_only: true,
      });
      getLogger().info(`Fetched stories page ${page} of ${perPage}`);

      if (!result) {
        return;
      }

      const { stories } = result;
      for (const story of stories) {
        yield story;
      }
    }
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
}

/**
 * Given a stream of stories, fetches the content for each story and streams the full story.
 * This is necessary because the content is not included in the stories stream.
 */
class StoriesStream extends Transform {
  private semaphore: Sema;

  constructor(private spaceId: string, private batchSize: number, private onProgress?: () => void) {
    super({
      objectMode: true,
    });

    this.semaphore = new Sema(this.batchSize);
  }

  async _transform(chunk: Omit<Story, 'content'>, _encoding: string, callback: (error?: Error | null, data?: any) => void) {
    try {
      await this.semaphore.acquire();
      const story = await fetchStory(this.spaceId, chunk.id.toString());
      this.push(story);
      this.onProgress?.();
      getLogger().info('Fetched story', { storyId: chunk.id });
      callback();
    }
    catch (maybeError) {
      const error = toError(maybeError);
      getLogger().error(error.message, { storyId: chunk.id, error, errorCode: ERROR_CODES.MIGRATION_STORY_FETCH_ERROR });
      callback(error);
    }
    finally {
      this.semaphore.release();
    }
  }

  _flush(callback: (error?: Error | null) => void) {
    // Process any remaining stories in the batch
    this.semaphore.drain().then(() => {
      callback();
    });
  }
}

/**
 * Creates a stream of stories
 */
export const createStoriesStream = async ({
  spaceId,
  params,
  batchSize = 100,
  onTotal,
  onProgress,
}: {
  spaceId: string;
  params: StoriesQueryParams;
  batchSize: number;
  onTotal: (total: number) => void;
  onProgress: () => void;
}): Promise<Readable> => {
  const iterator = storiesIterator(spaceId, params, onTotal);
  const listStoriesStream = Readable.from(iterator);
  return pipeline(listStoriesStream, new StoriesStream(spaceId, batchSize, onProgress), (err) => {
    if (err) {
      console.error(err);
      getLogger().error(err.message, { errorCode: ERROR_CODES.MIGRATION_CREATE_STORIES_PIPELINE_ERROR });
    }
  });
};
