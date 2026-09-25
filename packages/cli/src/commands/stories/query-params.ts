import type { StoriesQueryParams } from "./constants";
import { normalizeStartsWith } from "./constants";
import type { FilterQuery } from "./filter-query";
import { mergeFilterQuery, parseFilterQuery } from "./filter-query";

/**
 * The scope flags every story-listing command shares: `find`, `pull` and
 * `migrations run` take both, `validate` takes `--starts-with`. Sibling
 * subcommands must not import from each other, so the shared half lives here in
 * the parent command directory, and each command layers its own flags on top.
 */
export interface StoryScopeOptions {
  startsWith?: string;
  query?: string;
  /**
   * `filter_query` clauses a command builds from its own flags. Merged with the
   * parsed `--query` field by field, so a clause set by both is a usage error
   * rather than a silent overwrite.
   */
  extraFilterQuery?: FilterQuery;
}

export type StoryScopeParams = Pick<StoriesQueryParams, "starts_with" | "filter_query">;

export function buildStoryScopeParams({
  startsWith,
  query,
  extraFilterQuery,
}: StoryScopeOptions): StoryScopeParams {
  const params: StoryScopeParams = {};

  // A `full_slug` never starts with a slash and MAPI matches the prefix
  // literally, so `/en/blog/` would match nothing at all.
  if (startsWith !== undefined) {
    params.starts_with = normalizeStartsWith(startsWith) || undefined;
  }

  // `-q ''` is parsed rather than skipped, so it fails instead of filtering nothing.
  if (query !== undefined || extraFilterQuery) {
    params.filter_query = mergeFilterQuery(
      query !== undefined ? parseFilterQuery(query) : {},
      extraFilterQuery ?? {},
    );
  }

  return params;
}
