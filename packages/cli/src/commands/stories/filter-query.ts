import type { StoryListQuery } from "../../types";
import { CommandError } from "../../utils/error/command-error";

export type FilterQuery = NonNullable<StoryListQuery["filter_query"]>;

const CLAUSE_SYNTAX_HINT =
  'Expected Storyblok bracket syntax ("[field][operation]=value", clauses joined with "&") or a JSON object (\'{"field":{"operation":"value"}}\').';

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
 * Input that parses to nothing is a usage error rather than an empty filter. A
 * `filter_query` that never reaches the wire does not narrow anything, so the
 * command would answer a different, much larger question than the one asked —
 * with a plausible-looking result set and a zero exit code to hide it.
 */
export function parseFilterQuery(input: string): FilterQuery {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("{")) {
    return parseAsJson(trimmed);
  }

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

  // Field/operator names are free-form user input; MAPI validates them at runtime.
  return result as FilterQuery;
}

function parseAsJson(trimmed: string): FilterQuery {
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new CommandError(`Invalid --query JSON: ${(error as Error).message}\n${trimmed}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CommandError(`Invalid --query JSON: expected an object.\n${trimmed}`);
  }
  return parsed as FilterQuery;
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
