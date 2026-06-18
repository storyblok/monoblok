import { pipeline, Readable, Transform } from 'node:stream';
import type { Sema } from 'async-sema';
import { fetchStories, fetchStory } from '../../../stories/actions';
import type { StoriesQueryParams, Story } from '../../../stories/constants';
import { parseFilterQuery } from '../../../stories/filter-query';
import { handleAPIError, toError } from '../../../../utils/error';
import { getLogger } from '../../../../lib/logger/logger';
import { createPipelineBackpressureLock } from '../../../../utils/backpressure-lock';
import { ERROR_CODES } from '../constants';

/**
 * CLI-level migration filter params. Includes the ad-hoc inputs `componentName`
 * and `query` (a `filter_query` string), which are transformed into the API
 * query shape ({@link StoriesQueryParams}) before any request is made.
 */
export type MigrationStoriesParams = StoriesQueryParams & {
  componentName?: string;
  query?: string;
};

/**
 * Iterator that fetches stories
 */
export async function* storiesIterator(
  spaceId: string,
  params?: MigrationStoriesParams,
  onTotal?: (total: number) => void,
) {
  try {
    let perPage = 500;

    // Strip the CLI-only inputs and map them onto the API query shape.
    const { componentName, query, ...rest } = params ?? {};
    const transformedParams: StoriesQueryParams = { ...rest };

    // Component filter -> `contain_component`.
    if (componentName) {
      transformedParams.contain_component = componentName;
    }

    // Legacy `filter_query` string -> structured object (the wire format MAPI
    // requires; a raw string is rejected as a non-nested filter).
    if (query) {
      transformedParams.filter_query = parseFilterQuery(query);
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

  constructor(private spaceId: string, private onProgress?: () => void) {
    super({
      objectMode: true,
    });

    this.semaphore = createPipelineBackpressureLock();
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
  onTotal,
  onProgress,
}: {
  spaceId: string;
  params: MigrationStoriesParams;
  onTotal: (total: number) => void;
  onProgress: () => void;
}): Promise<Readable> => {
  const iterator = storiesIterator(spaceId, params, onTotal);
  const listStoriesStream = Readable.from(iterator);
  return pipeline(listStoriesStream, new StoriesStream(spaceId, onProgress), (err) => {
    if (err) {
      console.error(err);
      getLogger().error(err.message, { errorCode: ERROR_CODES.MIGRATION_CREATE_STORIES_PIPELINE_ERROR });
    }
  });
};
