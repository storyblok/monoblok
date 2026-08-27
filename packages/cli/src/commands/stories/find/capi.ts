import { createApiClient } from "@storyblok/api-client";
import type { CacheProvider } from "@storyblok/api-client";
import type { RegionCode } from "../../../constants";
import { CommandError } from "../../../utils/error/command-error";
import { fetchSpace } from "../../spaces/actions";
import type { Story } from "../constants";

/**
 * How many stories one CAPI request carries.
 *
 * 25 is a throughput optimum, not a size limit: the CDN's rate limit shrinks as
 * `per_page` grows — 50 req/s up to 25 entries, 15 up to 50, 6 above 75 — so a
 * bigger page buys fewer stories per second. `@storyblok/api-client` derives that
 * tier from `per_page` itself, which is why no `rateLimit` is configured below.
 */
export const CAPI_BATCH_SIZE = 25;

/**
 * How many CAPI batches may be in flight at once.
 *
 * The CDN answers a 25-story page in well under a second, so this many requests
 * keeps the 50 req/s tier busy, and it is what bounds the stage's memory: 24
 * batches hold the content of 600 stories at the high-water mark, all of it
 * discarded as soon as the filters have read it.
 */
export const CAPI_MAX_IN_FLIGHT_BATCHES = 24;

/**
 * Draft is the right default: MAPI's `story.content` is the draft content, so
 * anything else would filter against a different document than the one the
 * command emits. `--capi-params` can still ask for `published`.
 */
const DEFAULT_CAPI_PARAMS: CapiParams = { version: "draft" };

/**
 * Params the CAPI filter owns. Overriding `by_uuids` would break the batching and
 * a larger `per_page` would drop the request into a slower rate-limit tier, so
 * both are rejected rather than silently ignored.
 */
const RESERVED_CAPI_PARAMS = new Set(["by_uuids", "by_uuids_ordered", "per_page", "page"]);

/**
 * `lang` is what a story payload calls its language and what most people reach
 * for first; the CDN query parameter is `language`, and an unknown parameter is
 * ignored server-side, which would answer a different question than the one
 * asked. Accepting the alias is cheaper than failing on it.
 */
const CAPI_PARAM_ALIASES: Record<string, string> = { lang: "language" };

export type CapiParams = Record<string, string | number | boolean>;

/**
 * Content as MAPI's own story type declares it, which is the shape the merge and
 * the `--where` filters downstream already work against.
 */
export type StoryContent = NonNullable<Story["content"]>;

/** Resolves a batch of uuids to their content, or leaves them out if CAPI has none. */
export type CapiContentFetcher = (uuids: string[]) => Promise<Map<string, StoryContent>>;

/**
 * Removes the editor markers draft CAPI content carries and MAPI content does not.
 *
 * `_editable` is what the Visual Editor uses to map a rendered block back to its
 * source, and it is pure noise in a story that gets printed. Stripping it is what
 * lets CAPI content stand in for a MAPI fetch without the substitution showing up
 * in the output.
 */
export function stripEditorMarkers(content: StoryContent): StoryContent {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key !== "_editable") {
        result[key] = walk(nested);
      }
    }
    return result;
  };

  return walk(content) as StoryContent;
}

/**
 * Parses `--capi-params` into CDN query parameters.
 *
 * Accepts a JSON object (`{"version":"published"}`), the same thing without the
 * quoting a shell makes tedious (`{version: published}`), and bare pairs
 * (`version=published,language=de`). All three are the same request; the lenient
 * forms exist because this flag is typed by hand far more often than generated.
 */
export function parseCapiParams(raw: string | undefined): CapiParams {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = parseAsJson(trimmed) ?? parseAsPairs(trimmed);
  const params: CapiParams = {};

  for (const [rawKey, value] of Object.entries(parsed)) {
    const key = CAPI_PARAM_ALIASES[rawKey] ?? rawKey;
    if (RESERVED_CAPI_PARAMS.has(key)) {
      throw new CommandError(
        `--capi-params cannot set "${key}": the CAPI filter batches stories itself, ${CAPI_BATCH_SIZE} per request.`,
      );
    }
    params[key] = value;
  }

  return params;
}

/** Returns `undefined` for anything that is not a JSON object, so pairs can be tried next. */
function parseAsJson(raw: string): CapiParams | undefined {
  if (!raw.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CommandError(`--capi-params must be an object, got: ${raw}`);
    }
    return parsed as CapiParams;
  } catch (error) {
    if (error instanceof CommandError) {
      throw error;
    }
    return undefined;
  }
}

function parseAsPairs(raw: string): CapiParams {
  const body = raw.replace(/^\{/, "").replace(/\}$/, "");
  const params: CapiParams = {};

  for (const pair of body.split(/[,&]/)) {
    const entry = pair.trim();
    if (!entry) {
      continue;
    }
    const separator = entry.search(/[=:]/);
    if (separator < 0) {
      throw new CommandError(
        `Invalid --capi-params: ${raw}\nExpected an object ({"version":"published"}) or key=value pairs (version=published,language=de).`,
      );
    }
    const key = unquote(entry.slice(0, separator));
    const value = unquote(entry.slice(separator + 1));
    if (!key) {
      throw new CommandError(`Invalid --capi-params: ${raw}\nA parameter name is missing.`);
    }
    params[key] = value;
  }

  return params;
}

const unquote = (value: string): string => value.trim().replace(/^["']|["']$/g, "");

/**
 * Builds the batch content fetcher the CAPI filter stage runs on.
 *
 * The space's `first_token` is its first private (preview) token, which is what
 * makes `version=draft` readable. Resolving it costs one MAPI request up front
 * and fails the run there if it is missing, rather than after a few thousand
 * stories have already been listed.
 */
export async function createCapiContentFetcher({
  spaceId,
  region,
  params,
}: {
  spaceId: string;
  region: RegionCode | undefined;
  params: CapiParams;
}): Promise<CapiContentFetcher> {
  const space = await fetchSpace(spaceId);
  const token = space?.first_token;

  if (!token) {
    throw new CommandError(
      `No Content Delivery API token available for space ${spaceId}. --capi-filter reads content through the CDN, which needs the space's preview token.`,
    );
  }

  const client = createApiClient({
    accessToken: token,
    region: region ?? "eu",
    // Nothing is read twice, so a response cache would only grow. Draft requests
    // bypass it anyway; `published` ones are what a cache would serve, which
    // makes this explicit rather than incidental.
    cache: { provider: NO_CACHE_PROVIDER },
    // A failed batch has to reach the stage's error callback to be counted and
    // reported, so an HTTP error must reject rather than resolve as `{ error }`.
    throwOnError: true,
  });

  const query = { ...DEFAULT_CAPI_PARAMS, ...params };

  return async (uuids) => {
    const { data } = await client.stories.list({
      // `--capi-params` is free-form by design, so the merged query is only
      // known to be CDN query parameters, not which ones.
      query: {
        ...query,
        by_uuids: uuids.join(","),
        per_page: CAPI_BATCH_SIZE,
      } as NonNullable<Parameters<typeof client.stories.list>[0]>["query"],
    });

    const contentByUuid = new Map<string, StoryContent>();
    for (const story of data.stories) {
      if (story.uuid && story.content) {
        // CDN content and MAPI content are the same document in two generated
        // shapes; the filters downstream work against the MAPI one.
        contentByUuid.set(story.uuid, story.content as StoryContent);
      }
    }

    return contentByUuid;
  };
}

/**
 * Cache that stores nothing, for a client that reads every story exactly once.
 *
 * The client always has a provider — the default is an in-memory LRU that would
 * only grow over a full-space scan — so opting out means supplying one that
 * never retains a response.
 */
const NO_CACHE_PROVIDER: CacheProvider = {
  get: async () => undefined,
  set: async () => {},
  flush: async () => {},
};
