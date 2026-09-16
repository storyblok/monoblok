import type { DiffResult, NormalizedSchema } from "../types";
import { APIError, CommandError, toError } from "../../../utils";
import { fetchRemoteSchema, localToNormalized, remoteToNormalized } from "../actions";
import { formatDiff } from "../format-diff";
import { loadSchema } from "../load-schema";

/** A schema source: a numeric space ID or a path to a schema entry file. */
export function isSpaceRef(ref: string): boolean {
  return /^\d+$/.test(ref.trim());
}

/**
 * Adds "which side failed and what to check" context, but only to errors that do
 * not already explain themselves. A {@link CommandError} (a user mistake, exit
 * code 2) or an {@link APIError} (which renders its own message stack) is
 * rethrown untouched so the diagnosis and exit code match `schema push`.
 */
function withSourceContext(error: unknown, hint: string): Error {
  if (error instanceof CommandError || error instanceof APIError) {
    return error;
  }
  const cause = toError(error);
  return new Error(`${hint}: ${cause.message}`, { cause });
}

/**
 * Resolves a source ref to a {@link NormalizedSchema}: numeric → remote space,
 * otherwise → local entry file. `label` (e.g. `--from`) names the side in errors.
 */
export async function resolveSource(ref: string, label: string): Promise<NormalizedSchema> {
  const value = ref.trim();
  if (isSpaceRef(value)) {
    try {
      const { remote } = await fetchRemoteSchema(value);
      return remoteToNormalized(remote);
    } catch (error) {
      throw withSourceContext(
        error,
        `Could not load space "${value}" (${label}). Check the space ID and that you are logged in with access to it`,
      );
    }
  }
  try {
    const local = await loadSchema(value);
    if (local.components.length === 0 && local.datasources.length === 0) {
      throw new CommandError(
        `No blocks or datasources found in the schema entry file "${value}" (${label}). Verify the file exports schema definitions.`,
      );
    }
    return localToNormalized(local);
  } catch (error) {
    throw withSourceContext(
      error,
      `Could not load schema entry file "${value}" (${label}). Check the path, and that it is a project where the schema package and its dependencies are installed`,
    );
  }
}

/**
 * Formats the diff for human terminal output with direction-aware wording.
 * Unchanged entities are omitted from the listing (they stay in the summary
 * count) to keep space-to-space output readable.
 */
export function formatSchemaDiff(result: DiffResult, from: string, to: string): string {
  const labels = { create: "added", update: "changed", unchanged: "unchanged", stale: "removed" };
  return formatDiff(result, {
    header: `from ${from} → to ${to}`,
    tags: labels,
    summary: labels,
    showUnchanged: false,
    emptySummary: "no differences",
  });
}
