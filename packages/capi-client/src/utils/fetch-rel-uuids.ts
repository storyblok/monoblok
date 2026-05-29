import type { Client } from '../generated/capi/client';
import { listStories } from '../generated/capi/sdk.gen';
import type { Story } from '../generated/types/story';
import type { ThrottleManager } from './rate-limit';
import { chunkArray } from './array';

const UUID_CHUNK_SIZE = 50;
const QUERY_CONTEXT_KEYS = new Set([
  'cv',
  'fallback_lang',
  'from_release',
  'language',
  'resolve_assets',
  'resolve_links',
  'resolve_links_level',
  'version',
]);

const pickQueryContext = (baseQuery: Record<string, unknown>): Record<string, unknown> => {
  const query: Record<string, unknown> = {};
  for (const key of QUERY_CONTEXT_KEYS) {
    if (baseQuery[key] !== undefined) {
      query[key] = baseQuery[key];
    }
  }
  return query;
};

interface FetchMissingRelationsOptions {
  client: Client;
  uuids: string[];
  baseQuery: Record<string, unknown>;
  throttleManager: ThrottleManager;
}

export const fetchMissingRelations = async ({
  client,
  uuids,
  baseQuery,
  throttleManager,
}: FetchMissingRelationsOptions): Promise<Story[]> => {
  const queryContext = { ...pickQueryContext(baseQuery), per_page: UUID_CHUNK_SIZE };
  const chunks = chunkArray(uuids, UUID_CHUNK_SIZE);

  const results = await Promise.all(
    chunks.map(chunk =>
      throttleManager.execute('/v2/cdn/stories', queryContext, async () => {
        const response = await listStories({
          client,
          query: {
            ...queryContext,
            by_uuids: chunk.join(','),
            per_page: UUID_CHUNK_SIZE,
          },
        });

        throttleManager.adaptToResponse(response.response);

        if (response.error !== undefined) {
          throw response.error;
        }

        if (response.data === undefined) {
          throw new Error('Failed to fetch missing relations.');
        }

        // SDK return shape is the raw `DraftStory | PublishedStory` union; cast
        // to the wrapper `Story` (public type) so callers don't have to know
        // about the spec-level discriminated form and get the benefits of the
        // generic `Story` with schema support.
        return response.data.stories as unknown as Story[];
      }),
    ),
  );

  return results.flat();
};
