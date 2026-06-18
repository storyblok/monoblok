import type { StoryListQuery } from '../../types';

export type FilterQuery = NonNullable<StoryListQuery['filter_query']>;

/**
 * Parses the CLI `--query` value into the structured `filter_query` object the
 * Management API expects.
 *
 * Accepts two input forms:
 * - Storyblok bracket syntax: `[field][operation]=value`, multiple clauses
 *   joined with `&` (e.g. `[highlighted][in]=true&[component][in]=hero`).
 * - A JSON object string (e.g. `{"component":{"in":"hero"}}`).
 *
 * The returned object is serialized by the SDK as `filter_query[field][op]=value`
 * (deepObject style) — the wire format MAPI actually filters on. Passing the raw
 * string straight through instead yields a malformed `filter_query=<string>`
 * param that the API silently ignores.
 */
export function parseFilterQuery(input: string): FilterQuery {
  const trimmed = input.trim();
  if (!trimmed) { return {}; }

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as FilterQuery;
  }

  const result: Record<string, Record<string, string>> = {};
  for (const clause of trimmed.split('&')) {
    if (!clause) { continue; }
    const eq = clause.indexOf('=');
    if (eq === -1) { continue; }
    const path = clause.slice(0, eq);
    const value = clause.slice(eq + 1);
    const keys = [...path.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);
    if (keys.length < 2) { continue; }
    const [field, operation] = keys;
    result[field] = { ...result[field], [operation]: value };
  }
  // Field/operator names are free-form user input; MAPI validates them at runtime.
  return result as FilterQuery;
}
