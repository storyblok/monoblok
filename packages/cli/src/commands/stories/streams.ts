import { resolve } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import { fetchStories, fetchStory } from './actions';
import type { StoriesQueryParams, Story } from './constants';
import { saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils';

export const makeStoryPagesStream = ({
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
  storyBatchSize?: number;
  setTotalStories?: (total: number) => void;
  setTotalPages?: (totalPages: number) => void;
  onIncrement?: () => void;
  onPageSuccess?: (page: number, total: number) => void;
  onPageError?: (error: Error, page: number, total: number) => void;
}): Readable => {
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

export const makeStoriesStream = ({
  spaceId,
  batchSize = 12,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  spaceId: string;
  batchSize?: number;
  onIncrement?: () => void;
  onStorySuccess?: (story: Story) => void;
  onStoryError?: (error: Error, story: Story) => void;
}): Transform => {
  const readLock = new Sema(batchSize);
  const processing = new Set<Promise<void>>();

  return new Transform({
    objectMode: true,
    async transform(story: Story, _encoding, callback) {
      // Wait for a slot
      await readLock.acquire();

      const task = fetchStory(spaceId, story.id.toString())
        .then(() => {
          onStorySuccess?.(story);
          this.push(story);
        })
        .catch((maybeError) => {
          onStoryError?.(toError(maybeError), story);
        })
        .finally(() => {
          onIncrement?.();
          readLock.release();
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

export interface StorySaveStreamTransport {
  save: (story: Story) => Promise<void>;
}

export const makeStorySaveFSTransport = ({ directoryPath }: {
  directoryPath: string;
}) => ({
  save: async (story: Story) => {
    await saveToFile(resolve(directoryPath, `${story.slug}_${story.uuid}.json`), JSON.stringify(story, null, 2));
  },
});

export const makeStorySaveStream = ({
  transport,
  onIncrement,
  onStorySuccess,
  onStoryError,
}: {
  transport: StorySaveStreamTransport;
  onIncrement?: () => void;
  onStorySuccess?: (story: Story) => void;
  onStoryError?: (error: Error, story: Story) => void;
}) => {
  return new Writable({
    objectMode: true,
    write: async (story: Story, _encoding, callback) => {
      try {
        await transport.save(story);
        onStorySuccess?.(story);
      }
      catch (maybeError) {
        onStoryError?.(toError(maybeError), story);
      }
      finally {
        onIncrement?.();
        callback();
      }
    },
  });
};
