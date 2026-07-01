import type { DiffResult, EntityDiff, NormalizedSchema } from '../types';
import { fetchRemoteSchema, localToNormalized, remoteToNormalized } from '../actions';
import { formatDiff } from '../format-diff';
import { loadSchema } from '../load-schema';

/** A schema source: a numeric space ID or a path to a schema entry file. */
export function isSpaceRef(ref: string): boolean {
  return /^\d+$/.test(ref.trim());
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
    }
    catch (error) {
      throw new Error(
        `Could not load space "${value}" (${label}): ${describeError(error)}. Check the space ID and that you are logged in with access to it.`,
      );
    }
  }
  try {
    return localToNormalized(await loadSchema(value));
  }
  catch (error) {
    throw new Error(
      `Could not load schema entry file "${value}" (${label}): ${describeError(error)}. Check the path, and that it is a project where the schema package and its dependencies are installed.`,
    );
  }
}

/** Machine-readable diff payload emitted via the reporter's `meta.diff`. */
export interface SchemaDiffReport {
  from: string;
  to: string;
  summary: { create: number; update: number; unchanged: number; stale: number };
  entities: EntityDiff[];
}

/** Builds the serializable diff payload for the reporter. */
export function buildDiffReport(result: DiffResult, from: string, to: string): SchemaDiffReport {
  return {
    from,
    to,
    summary: { create: result.creates, update: result.updates, unchanged: result.unchanged, stale: result.stale },
    entities: result.diffs,
  };
}

/**
 * Formats the diff for human terminal output with direction-aware wording.
 * Unchanged entities are omitted from the listing (they stay in the summary
 * count and in `meta.diff`) to keep space-to-space output readable.
 */
export function formatSchemaDiff(result: DiffResult, from: string, to: string): string {
  const labels = { create: 'added', update: 'changed', unchanged: 'unchanged', stale: 'removed' };
  return formatDiff(result, {
    header: `from ${from} → to ${to}`,
    tags: labels,
    summary: labels,
    showUnchanged: false,
    emptySummary: 'no differences',
  });
}
