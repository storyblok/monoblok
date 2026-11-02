import type { Component } from "../../../types";
import type { DiffResult, RemoteSchemaData, SchemaData } from "../types";

export type BlockRename = { from: string; to: string };

/** Share of fields two blocks must have in common to count as one renamed block. */
const MIN_FIELD_OVERLAP = 0.5;

function fieldSignatures(component: Pick<Component, "schema">): Set<string> {
  return new Set(
    Object.entries(component.schema ?? {})
      .filter(([, field]) => typeof field?.type === "string")
      .map(([name, field]) => `${name}:${field.type}`),
  );
}

/**
 * Fields both blocks have with the same type, relative to the block with fewer
 * fields, so a rename that also adds or renames a field still pairs.
 */
function fieldOverlap(a: Set<string>, b: Set<string>): number {
  const smaller = Math.min(a.size, b.size);
  if (smaller === 0) return 0;
  return [...a].filter((signature) => b.has(signature)).length / smaller;
}

/**
 * Pairs blocks only the space has with blocks only the local schema has, when
 * they share most of their fields and both are or both aren't content types.
 * A rename otherwise reaches the space as a new block plus a stale one, and
 * the stories using the old name keep content no block describes.
 */
export function detectBlockRenames(
  diffResult: DiffResult,
  local: SchemaData,
  remote: RemoteSchemaData,
): BlockRename[] {
  const namesWith = (action: "create" | "stale") =>
    diffResult.diffs
      .filter((d) => d.type === "component" && d.action === action)
      .map((d) => d.name);
  const added = namesWith("create").flatMap((name) => {
    const component = local.components.find((c) => c.name === name);
    return component ? [{ component, fields: fieldSignatures(component) }] : [];
  });
  const renames: BlockRename[] = [];
  const paired = new Set<string>();

  for (const name of namesWith("stale")) {
    const removed = remote.components.get(name);
    if (!removed) continue;
    const fields = fieldSignatures(removed);
    let best: { name: string; overlap: number } | undefined;
    for (const candidate of added) {
      if (paired.has(candidate.component.name)) continue;
      if (Boolean(candidate.component.is_root) !== Boolean(removed.is_root)) continue;
      const overlap = fieldOverlap(fields, candidate.fields);
      if (overlap >= MIN_FIELD_OVERLAP && overlap > (best?.overlap ?? 0)) {
        best = { name: candidate.component.name, overlap };
      }
    }
    if (best) {
      renames.push({ from: name, to: best.name });
      paired.add(best.name);
    }
  }
  return renames;
}

/**
 * The space as if each renamed block already had its new name, so the diff
 * treats the rename as an update of the existing block. The push then
 * renames it in place, keeping its id, instead of creating a new block and
 * leaving the old one stale.
 */
export function withBlockRenames(
  remote: RemoteSchemaData,
  renames: readonly BlockRename[],
): RemoteSchemaData {
  const components = new Map(remote.components);
  for (const { from, to } of renames) {
    const component = components.get(from);
    if (!component) continue;
    components.delete(from);
    components.set(to, component);
  }
  return { ...remote, components };
}
