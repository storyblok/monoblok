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
 * code 2) keeps its own diagnosis and exit code, gaining only the side label
 * when it does not already name one — the shared loader and validator errors are
 * written for commands that take a single schema, so without it a two-sided diff
 * leaves the reader guessing which file is meant. An {@link APIError} renders its
 * own message stack and is rethrown untouched.
 *
 * The hint speaks to reaching the file at all, so it is only added when the file
 * could not be loaded. An error thrown *by* the module — a `define*()` rejecting
 * its input, say — means the path and the install were fine, and telling the
 * reader to check them sends them after a fault that is not there.
 */
function withSourceContext(error: unknown, hint: string, label: string): Error {
  if (error instanceof CommandError) {
    return error.message.includes(label) ? error : new CommandError(`${error.message} (${label})`);
  }
  if (error instanceof APIError) {
    return error;
  }
  const cause = toError(error);
  if (!isModuleResolutionError(cause)) {
    return new Error(`${cause.message} (${label})`, { cause });
  }
  return new Error(`${hint}: ${cause.message}`, { cause });
}

/**
 * Whether an error is the module system failing to reach or parse the entry
 * file, as opposed to the entry file running and throwing.
 */
function isModuleResolutionError(error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND" || code === "ENOENT") {
    return true;
  }
  return /cannot find module|failed to load|unexpected token|transform failed/i.test(error.message);
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
        label,
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
      label,
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
    unmanagedFolderNote: (names) =>
      `Group membership not compared for ${names.join(", ")}: a schema file manages a block's ` +
      `group only when the block declares a \`folder\`, so each of these keeps whichever group ` +
      `the space already has it in.`,
    emptySummary: "no differences",
  });
}
