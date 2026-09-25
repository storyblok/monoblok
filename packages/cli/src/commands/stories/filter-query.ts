import type { StoryListQuery } from "../../types";
import { CommandError } from "../../utils/error/command-error";
import { isRecord } from "../../utils/object";

export type FilterQuery = NonNullable<StoryListQuery["filter_query"]>;

const CLAUSE_SYNTAX_HINT =
  'Expected Storyblok bracket syntax ("[field][operation]=value", clauses joined with "&") or a JSON object (\'{"field":{"operation":"value"}}\').';

/**
 * The operations the Management API applies to a `filter_query` clause.
 *
 * The API skips an operation it does not know rather than rejecting it, so a
 * typo such as `[category][eq]=news` would drop the whole filter and return
 * every story in scope. Checked here so that fails as a usage error instead.
 */
const FILTER_QUERY_OPERATIONS = new Set([
  "in",
  "not_in",
  "is",
  "like",
  "not_like",
  "all",
  "exists",
  "in_array",
  "all_in_array",
  "eq_array",
  "gt_int",
  "lt_int",
  "gt-int",
  "lt-int",
  "gt_num",
  "lt_num",
  "gt-num",
  "lt-num",
  "gt_float",
  "lt_float",
  "gt-float",
  "lt-float",
  "gt_date",
  "lt_date",
  "gt-date",
  "lt-date",
]);

const OPERATIONS_HINT =
  "Supported operations: in, not_in, is, like, not_like, all, exists, in_array, all_in_array, eq_array, gt_int, lt_int, gt_float, lt_float, gt_date, lt_date.";

/**
 * Parses the CLI `--query` value into the structured `filter_query` object the
 * Management API expects.
 *
 * Accepts two input forms:
 * - Storyblok bracket syntax: `[field][operation]=value`, multiple clauses
 *   joined with `&` (e.g. `[highlighted][in]=true&[component][in]=hero`).
 * - A JSON object string (e.g. `{"component":{"in":"hero"}}`).
 *
 * The returned object is serialized as `filter_query[field][op]=value`
 * (deepObject style) — the wire format MAPI actually filters on. Passing the raw
 * string straight through instead yields a malformed `filter_query=<string>`
 * param that the API silently ignores.
 *
 * Throws on input that yields no clause or names an unknown operation. Either
 * way nothing would narrow the listing, and the command would return the whole
 * scope at exit 0.
 */
export function parseFilterQuery(input: string): FilterQuery {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new CommandError(`--query is empty.\n${CLAUSE_SYNTAX_HINT}`);
  }

  const result = trimmed.startsWith("{") ? parseAsJson(trimmed) : parseAsClauses(trimmed);

  const fields = Object.entries(result);
  if (fields.length === 0) {
    throw new CommandError(`--query has no clauses: ${input}\n${CLAUSE_SYNTAX_HINT}`);
  }

  const unknown = fields.flatMap(([field, operations]) =>
    Object.keys(operations)
      .filter((operation) => !FILTER_QUERY_OPERATIONS.has(operation))
      .map((operation) => `[${field}][${operation}]`),
  );
  if (unknown.length > 0) {
    throw new CommandError(
      `Unknown --query operation${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}\n${OPERATIONS_HINT}`,
    );
  }

  // Field names are free-form: they are the space's own content fields.
  return result as FilterQuery;
}

type ParsedFilterQuery = Record<string, Record<string, unknown>>;

function parseAsClauses(trimmed: string): ParsedFilterQuery {
  const result: Record<string, Record<string, string>> = {};
  const ignored: string[] = [];
  for (const clause of trimmed.split("&")) {
    if (!clause) {
      continue;
    }
    const eq = clause.indexOf("=");
    const path = eq === -1 ? clause : clause.slice(0, eq);
    const keys = [...path.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
    if (eq === -1 || keys.length < 2) {
      ignored.push(clause);
      continue;
    }
    const [field, operation] = keys;
    result[field] = { ...result[field], [operation]: clause.slice(eq + 1) };
  }

  if (ignored.length > 0) {
    throw new CommandError(
      `Invalid --query clause${ignored.length > 1 ? "s" : ""}: ${ignored.join(", ")}\n${CLAUSE_SYNTAX_HINT}`,
    );
  }
  return result;
}

function parseAsJson(trimmed: string): ParsedFilterQuery {
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new CommandError(`Invalid --query JSON: ${(error as Error).message}\n${trimmed}`);
  }
  if (!isRecord(parsed)) {
    throw new CommandError(`Invalid --query JSON: expected an object.\n${trimmed}`);
  }
  // MAPI rejects a `filter_query` that is not a hash of hashes outright.
  const flat = Object.keys(parsed).filter((field) => !isRecord(parsed[field]));
  if (flat.length > 0) {
    throw new CommandError(
      `Invalid --query JSON: each field needs an object of operations, e.g. {"${flat[0]}":{"in":"value"}}.\n${trimmed}`,
    );
  }
  return parsed as ParsedFilterQuery;
}

/**
 * Combines filter queries that come from different flags into the single
 * `filter_query` param MAPI accepts.
 *
 * Merges one field at a time, so `--query "[highlighted][in]=true"` and a flag
 * that contributes `component` both survive. A field/operation pair set by both
 * sides is a usage error: a plain object spread would let the last one win
 * silently, which drops a filter the user explicitly asked for.
 */
export function mergeFilterQuery(base: FilterQuery, overlay: FilterQuery): FilterQuery {
  const merged: Record<string, Record<string, unknown>> = {
    ...(base as Record<string, Record<string, unknown>>),
  };

  for (const [field, operations] of Object.entries(
    overlay as Record<string, Record<string, unknown>>,
  )) {
    const existing = merged[field];
    if (!existing) {
      merged[field] = operations;
      continue;
    }
    for (const operation of Object.keys(operations)) {
      if (operation in existing) {
        throw new CommandError(
          `Conflicting filters for "${field}": "${operation}" is set twice, by --query and by another flag. Drop one of them.`,
        );
      }
    }
    merged[field] = { ...existing, ...operations };
  }

  return merged as FilterQuery;
}
