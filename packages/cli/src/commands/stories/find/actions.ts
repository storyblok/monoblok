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
import { parseCapiParams } from "./capi";

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

  // `--skip-content` is about what the run *emits* and what it fetches per
  // story, not a ban on reading content anywhere: `--capi-filter` still reads it
  // in bulk to decide matches, and the output stays list metadata. Only a check
  // that has no other source for content is refused.
  if (options.skipContent && options.checkReferences) {
    throw new CommandError(
      "--skip-content cannot be combined with --check-references: references live in the story content it skips fetching.",
    );
  }

  if (options.capiParams && !options.capiFilter) {
    throw new CommandError("--capi-params has no effect without --capi-filter.");
  }

  if (options.capiFilter) {
    // With `--check-references` there is nothing to prune, because the scan reads
    // every story in scope. The flag still pays off there as a *content source*:
    // the CDN serves the same draft content in bulk that the per-story MAPI fetch
    // returns one at a time, so `--where` is not required for it to do anything.
    if (!options.where?.length && !options.checkReferences) {
      throw new CommandError(
        "--capi-filter needs at least one --where filter: without one, every listed story is a match and none can be pruned.",
      );
    }
    // Parsed here as well as at build time so a malformed value fails as a usage
    // error, next to the flags it belongs with.
    parseCapiParams(options.capiParams);
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
  if (options.includesBlock) {
    params.contain_component = options.includesBlock;
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
 * `changed` needs `unpublished_changes`, which the list response already
 * carries. That is what lets these run as `preContentFilters`, before the
 * content fetch and before the CAPI filter, so a non-matching story costs
 * nothing beyond the page it was listed on.
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
