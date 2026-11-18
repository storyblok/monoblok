import type { WireComponent } from "@storyblok/schema/codegen";
import { getMapiClient } from "../../../api";
import type { Component, ComponentUpdate } from "../../../types";
import { CommandError, isRecord } from "../../../utils";
import { delay } from "../../../utils/fetch";
import type { DiffResult, RemoteSchemaData, SchemaData } from "../types";
import { countStoriesUsing } from "./story-folders";

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

const BLOCK_LIST_KEYS = ["component_whitelist", "component_denylist"];

/**
 * `components` as the space holds them once it renamed each block in `renames`:
 * the block under its new name, and the fields that allow or deny it naming it
 * so.
 */
export function withRenamedBlocks(
  components: readonly WireComponent[],
  renames: readonly BlockRename[],
): WireComponent[] {
  if (renames.length === 0) return [...components];
  const renamed = new Map(renames.map(({ from, to }) => [from, to]));
  const rename = (name: unknown) => (typeof name === "string" ? (renamed.get(name) ?? name) : name);
  const renameLists = (field: unknown) => {
    if (!isRecord(field)) return field;
    const lists = BLOCK_LIST_KEYS.filter((key) => Array.isArray(field[key])).map((key) => {
      const list: unknown[] = Array.isArray(field[key]) ? field[key] : [];
      return [key, list.map(rename)];
    });
    return lists.length === 0 ? field : { ...field, ...Object.fromEntries(lists) };
  };
  return components.map((component) => ({
    ...component,
    name: renamed.get(component.name) ?? component.name,
    schema: isRecord(component.schema)
      ? Object.fromEntries(
          Object.entries(component.schema).map(([key, field]) => [key, renameLists(field)]),
        )
      : component.schema,
  }));
}

/** How often to check whether the space finished renaming a block in its stories. */
const RENAME_POLL_INTERVAL_MS = 2_000;
/** How long to wait for the space to rename a block in its stories. */
export const RENAME_TIMEOUT_MS = 10 * 60_000;

/**
 * Whether the space refused the request because it is renaming a block or a
 * field in its stories in the background, which blocks every block update
 * until it finishes.
 */
function isRenameRunning(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error.response)) return false;
  const { status, data } = error.response;
  return (
    status === 422 &&
    isRecord(data) &&
    typeof data.error === "string" &&
    /running in the background/i.test(data.error)
  );
}

/**
 * Renames a block in place and has the space rename it in the stories,
 * folders, and other blocks that name it. The space renames the block in the
 * stories of a small space right away and in the background otherwise.
 */
export async function renameBlockInSpace(
  space: string,
  id: number,
  component: ComponentUpdate,
  { from, to }: BlockRename,
): Promise<void> {
  const deadline = Date.now() + RENAME_TIMEOUT_MS;
  for (;;) {
    try {
      await getMapiClient().components.update(id, {
        path: { space_id: Number(space) },
        body: { component },
        query: { update_content: true },
        throwOnError: true,
      });
      return;
    } catch (error) {
      if (!isRenameRunning(error)) throw error;
      if (Date.now() >= deadline) {
        throw new CommandError(
          `The space is still renaming a block or field in the background, so ${from} could not be renamed to ${to}. Wait until it finishes, then run schema push again.`,
        );
      }
      await delay(RENAME_POLL_INTERVAL_MS);
    }
  }
}

/** Waits until no story uses the name a block had before `rename`. */
export async function waitUntilStoriesRenamed(
  space: string,
  { from, to }: BlockRename,
): Promise<void> {
  const deadline = Date.now() + RENAME_TIMEOUT_MS;
  while ((await countStoriesUsing(space, from)) > 0) {
    if (Date.now() >= deadline) {
      throw new CommandError(
        `The space is still renaming ${from} to ${to} in the stories that use it. Wait until it finishes, then run schema push again to push the rest of the schema before you run content migrations.`,
      );
    }
    await delay(RENAME_POLL_INTERVAL_MS);
  }
}
