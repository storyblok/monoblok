import { compile } from "json-p3";
import type { JSONValue } from "json-p3";
import type { StoriesQueryParams, Story } from "../constants";
import { fetchStories } from "../actions";
import { buildStoryScopeParams } from "../query-params";
import { chunk } from "../../../utils/array";
import { createPipelineBackpressureLock } from "../../../utils/backpressure-lock";
import { CommandError } from "../../../utils/error/command-error";
import type { TargetMeta } from "./references";
import { toTargetMeta } from "./references";
import type { ClientFilter, FindOptions } from "./types";
import { matchesPublishStatus, publishStatusToQueryParams } from "./filters";
import { parseCapiParams } from "./capi";

/**
 * One UUID in the canonical form, per RFC 4122 and RFC 9562.
 *
 * The version nibble is restricted to the versions Storyblok issues (1, 3, 4, 5,
 * 7, 8) and the variant nibble to `8`-`b`, which is what the API itself matches.
 * A looser pattern here would accept a value the server then rejects, which is
 * the failure this check exists to prevent.
 */
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[134578][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

/** One UUID, or several separated by commas. Mirrors the API's own list form. */
const REFERENCE_UUIDS = new RegExp(`^\\s*(?:${UUID_PATTERN}\\s*,?\\s*)+$`, "i");

/**
 * Rejects options the command accepts on the surface but cannot honour yet.
 *
 * Silently ignoring an explicitly passed flag is worse than failing: the user
 * gets a full, plausible result set that answers a different question.
 */
export function assertSupportedOptions(options: FindOptions): void {
  // The API reads `reference_search` as a UUID list and, when it parses as none,
  // silently falls back to a substring scan of raw story content. A typo'd UUID
  // therefore returns a slow, plausible, and completely different result set
  // rather than an error, so it has to be caught here.
  if (options.references !== undefined && !REFERENCE_UUIDS.test(options.references)) {
    throw new CommandError(
      `--references expects a story UUID, or several separated by commas, and got: ${options.references}\n` +
        "A UUID looks like 0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0e. `stories find <text>` is what searches content for a term.",
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
    const capiParams = parseCapiParams(options.capiParams);

    // Asking the CDN for published content answers "what is live", but a story
    // with no published version is undecidable there: it passes through and is
    // settled against MAPI's *draft* content, so a run that reads as "what is
    // live" reports stories that have never been published. `--publish-status
    // published` is what removes them from the scope in the first place.
    if (
      capiParams.version !== undefined &&
      capiParams.version !== "draft" &&
      options.publishStatus !== "published"
    ) {
      throw new CommandError(
        `--capi-params version=${String(capiParams.version)} needs --publish-status published: stories with no published content cannot be decided from CDN content, and would otherwise be matched against their draft instead.`,
      );
    }
  }
}

/**
 * Reads `--limit` as a positive whole number of results.
 *
 * Commander hands every option over as a string, and the failure this guards
 * against is quiet: `--limit 0` or `--limit abc` would become `NaN` or `0`, and
 * a run that stopped at the first line would look like a search that matched
 * almost nothing.
 */
export function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new CommandError(`--limit expects a whole number of 1 or more, and got: ${raw}`);
  }
  return value;
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

  // Path scope and filter query, shared with every other story-listing command.
  // `--container-block product` is shorthand for a `component` clause, so it is
  // handed over as an extra clause rather than spread over the parsed `--query`:
  // both write `component`, and a spread would drop one of them without a word.
  Object.assign(
    params,
    buildStoryScopeParams({
      startsWith: options.startsWith,
      query: options.query,
      extraFilterQuery: options.containerBlock
        ? { component: { in: options.containerBlock } }
        : undefined,
    }),
  );

  // Contains block (server-side contain_component)
  if (options.includesBlock) {
    params.contain_component = options.includesBlock;
  }

  // Tags and workflow stages are both "any of these" on the server: a story
  // matches when it carries one of the listed values, unlike `--includes-block`,
  // where the listed blocks must all be present.
  if (options.tag) {
    params.with_tag = options.tag;
  }

  if (options.workflowStage) {
    params.in_workflow_stages = options.workflowStage;
  }

  // Publish status (server-side part)
  if (options.publishStatus) {
    Object.assign(params, publishStatusToQueryParams(options.publishStatus));
  }

  // Ordering is the server's job: it decides which stories are on the first
  // page, so it has to be applied before the walk rather than to the results.
  // An unsortable column is rejected by the API, which is the only place that
  // knows the space's own fields.
  if (options.sort) {
    params.sort_by = options.sort;
  }

  // Reference search (server-side)
  if (options.references) {
    params.reference_search = options.references;
  }

  // Without a content fetch, the listing is the whole answer, so ask for the
  // one part of it that is opt-in. MAPI returns `content_summary: {}` unless
  // `with_summary` is set, and a per-field digest is often enough to tell two
  // stories apart when the content itself is not being fetched.
  if (options.skipContent) {
    params.with_summary = true;
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
