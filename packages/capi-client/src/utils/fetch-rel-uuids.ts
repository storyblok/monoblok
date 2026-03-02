import type { Client } from '../generated/stories/client';
import { getAll } from '../generated/stories/sdk.gen';
import type { StoryCapi } from '../generated/stories/types.gen';
import type { ThrottleManager } from '../rate-limit';
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
    query[key] = baseQuery[key];
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
}: FetchMissingRelationsOptions): Promise<StoryCapi[]> => {
  const queryContext = pickQueryContext(baseQuery);
  const chunks = chunkArray(uuids, UUID_CHUNK_SIZE);

  const results = await Promise.all(
    chunks.map(chunk =>
      throttleManager.execute('/v2/cdn/stories', queryContext, async () => {
        const response = await getAll({
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

        return response.data.stories;
      }),
    ),
  );

  return results.flat();
};
