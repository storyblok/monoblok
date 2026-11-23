import type { Client } from "../generated/capi/client";
import { listStories } from "../generated/capi/sdk.gen";
import type { ListStoriesResponses } from "../generated/capi/types.gen";
import type { Story } from "../generated/types/story";
import type { ThrottleManager } from "./rate-limit";
import { chunkArray } from "./array";

const UUID_CHUNK_SIZE = 50;
const QUERY_CONTEXT_KEYS = new Set([
  "cv",
  "excluding_fields",
  "excluding_story_fields",
  "fallback_lang",
  "from_release",
  "language",
  "resolve_assets",
  "resolve_links",
  "resolve_links_level",
  "version",
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

type ResolvedLinks = NonNullable<ListStoriesResponses[200]["links"]>;

interface FetchStoriesByUuidsOptions {
  client: Client;
  uuids: string[];
  baseQuery: Record<string, unknown>;
  throttleManager: ThrottleManager;
  signal?: AbortSignal;
}

export interface StoriesByUuids {
  stories: Story[];
  /** The links the API resolved in `stories`, when `baseQuery` has `resolve_links`. */
  links: ResolvedLinks;
}

/**
 * Fetches the stories the API listed by UUID instead of resolving them, e.g. `rel_uuids` or
 * `link_uuids` beyond its resolve limit, in the context of the original request. Throws the
 * API error of a failed request.
 */
export const fetchStoriesByUuids = async ({
  client,
  uuids,
  baseQuery,
  throttleManager,
  signal,
}: FetchStoriesByUuidsOptions): Promise<StoriesByUuids> => {
  const queryContext = { ...pickQueryContext(baseQuery), per_page: UUID_CHUNK_SIZE };
  const chunks = chunkArray(uuids, UUID_CHUNK_SIZE);

  const results = await Promise.all(
    chunks.map((chunk) =>
      throttleManager.execute("/v2/cdn/stories", queryContext, async () => {
        const response = await listStories({
          client,
          query: {
            ...queryContext,
            by_uuids: chunk.join(","),
            per_page: UUID_CHUNK_SIZE,
          },
          signal,
          throwOnError: false,
        });

        if (response.error !== undefined) {
          throw response.error;
        }

        if (response.data === undefined) {
          throw new Error("Failed to fetch stories by UUID.");
        }

        return {
          // SDK return shape is the raw `DraftStory | PublishedStory` union; cast
          // to the wrapper `Story` (public type) so callers don't have to know
          // about the spec-level discriminated form and get the benefits of the
          // generic `Story` with schema support.
          stories: response.data.stories as unknown as Story[],
          links: response.data.links ?? [],
        };
      }),
    ),
  );

  return {
    stories: results.flatMap((result) => result.stories),
    links: results.flatMap((result) => result.links),
  };
};
