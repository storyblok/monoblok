import { compile } from "json-p3";
import type { JSONValue } from "json-p3";
import type { StoriesQueryParams, Story } from "../constants";
import { normalizeStartsWith } from "../constants";
import { fetchStories } from "../actions";
import { parseFilterQuery } from "../filter-query";
import { chunk } from "../../../utils/array";
import { createPipelineBackpressureLock } from "../../../utils/backpressure-lock";
import { CommandError } from "../../../utils/error/command-error";
import type { TargetMeta } from "./references";
import { toTargetMeta } from "./references";
import type { ClientFilter, FindOptions } from "./types";
import { matchesPublishStatus, publishStatusToQueryParams } from "./filters";

/**
 * Rejects options the command accepts on the surface but cannot honour yet.
 *
 * Silently ignoring an explicitly passed flag is worse than failing: the user
 * gets a full, plausible result set that answers a different question.
 */
export function assertSupportedOptions(options: FindOptions): void {
  if (options.searchMode && options.searchMode !== "fulltext") {
    throw new CommandError(
      `Search mode "${options.searchMode}" is not supported yet. Only "fulltext" is available.`,
    );
  }
}

export function buildQueryParams(
  text: string | undefined,
  options: FindOptions,
): StoriesQueryParams {
  const params: StoriesQueryParams = {};

  // Text search
  if (text) {
    params.text_search = text;
  }

  // Path scope. A `full_slug` never starts with a slash and MAPI matches the
  // prefix literally, so `/en/blog/` would match nothing at all.
  if (options.startsWith !== undefined) {
    params.starts_with = normalizeStartsWith(options.startsWith) || undefined;
  }

  // Filter query and container block (both contribute to filter_query)
  if (options.query || options.containerBlock) {
    params.filter_query = {
      ...(options.query ? parseFilterQuery(options.query) : {}),
      ...(options.containerBlock ? { component: { in: options.containerBlock } } : {}),
    };
  }

  // Contains block (server-side contain_component)
  if (options.containsBlock) {
    params.contain_component = options.containsBlock;
  }

  // Publish status (server-side part)
  if (options.publishStatus) {
    Object.assign(params, publishStatusToQueryParams(options.publishStatus));
  }

  // Reference search (server-side)
  if (options.references) {
    params.reference_search = options.references;
  }

  // Entry type filter
  if (options.entryType === "story") {
    params.story_only = true;
  } else if (options.entryType === "folder") {
    params.folder_only = true;
  }

  return params;
}

/**
 * Client-side half of `--publish-status`.
 *
 * The server can only narrow to `is_published`; telling `published` from
 * `changed` needs `unpublished_changes`, which is only on the fetched story.
 * `draft` is fully server-side, so it contributes no filter.
 */
export function buildPublishStatusFilters(options: FindOptions): ClientFilter[] {
  const status = options.publishStatus;
  if (!status || status === "draft") {
    return [];
  }
  return [(story) => matchesPublishStatus(story, status)];
}

/**
 * Compiles `--where` JSONPath (RFC 9535) expressions into filters.
 *
 * Compiling up front does double duty: a malformed expression fails as a usage
 * error before a single story is fetched, and the parsed query is reused for
 * every story instead of being re-parsed per document.
 */
export function buildWhereFilters(expressions: string[] | undefined): ClientFilter[] {
  if (!expressions?.length) {
    return [];
  }
  return expressions.map((expression) => {
    const query = compileWhere(expression);
    // `match` stops at the first hit; a filter only needs to know whether the
    // expression selects anything, never the full node list.
    return (story: Story) => query.match(toJsonValue(story)) !== undefined;
  });
}

function compileWhere(expression: string) {
  try {
    return compile(expression);
  } catch (error) {
    throw new CommandError(
      `Invalid --where JSONPath expression: ${expression}\n${(error as Error).message}`,
    );
  }
}

/**
 * A story is plain JSON off the wire, but its generated type is an interface,
 * and TypeScript gives interfaces no implicit index signature, so it will not
 * structurally match `JSONValue`. The assertion records what the runtime shape
 * already is rather than reinterpreting it.
 */
const toJsonValue = (story: Story): JSONValue => story as JSONValue;

export function applyClientFilters(story: Story, filters: ClientFilter[]): boolean {
  return filters.every((filter) => filter(story));
}

/** MAPI accepts `by_uuids` as a comma-separated list; one page per batch. */
const UUID_BATCH_SIZE = 100;

/**
 * Resolves metadata for reference targets that fall outside the fetched result
 * set — anything a scoped search (`--starts-with`, `--entry-type`, …) never saw.
 *
 * Batches run concurrently; in-flight requests are bounded by the same
 * backpressure lock the story pipeline uses, and the MAPI client applies the
 * globally configured rate limit on top.
 */
export async function resolveReferenceTargets({
  spaceId,
  uuids,
  onBatchSettled,
}: {
  spaceId: string;
  uuids: Iterable<string>;
  onBatchSettled?: (size: number) => void;
}): Promise<Map<string, TargetMeta>> {
  const resolved = new Map<string, TargetMeta>();
  const batches = chunk(uuids, UUID_BATCH_SIZE);
  if (batches.length === 0) {
    return resolved;
  }

  const lock = createPipelineBackpressureLock();
  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      await lock.acquire();
      try {
        const result = await fetchStories(spaceId, {
          by_uuids: batch.join(","),
          per_page: batch.length,
        });
        for (const story of result?.stories ?? []) {
          resolved.set(story.uuid, toTargetMeta(story));
        }
      } finally {
        lock.release();
        onBatchSettled?.(batch.length);
      }
    }),
  );

  // An unresolved batch would make every reference in it look broken, so a
  // partial answer is worse than none. `allSettled` first, so a sibling
  // rejection never surfaces as an unhandled rejection.
  const failed = settled.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    throw failed.reason;
  }

  return resolved;
}
