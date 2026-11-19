import type { WireComponent } from "@storyblok/schema/internal/codegen";
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
 * they share most of their fields and both or neither can be a story.
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
 * the block under its new name, and the fields that allow, deny, or filter by
 * it naming it so.
 */
export function withRenamedBlocks(
  components: readonly WireComponent[],
  renames: readonly BlockRename[],
): WireComponent[] {
  if (renames.length === 0) return [...components];
  const renamed = new Map(renames.map(({ from, to }) => [from, to]));
  const rename = (name: unknown) => (typeof name === "string" ? (renamed.get(name) ?? name) : name);
  const renameReferences = (field: unknown) => {
    if (!isRecord(field)) return field;
    const references: [string, unknown][] = BLOCK_LIST_KEYS.filter((key) =>
      Array.isArray(field[key]),
    ).map((key) => {
      const list: unknown[] = Array.isArray(field[key]) ? field[key] : [];
      return [key, list.map(rename)];
    });
    if (typeof field.filter_content_type === "string") {
      references.push(["filter_content_type", rename(field.filter_content_type)]);
    }
    return references.length === 0 ? field : { ...field, ...Object.fromEntries(references) };
  };
  return components.map((component) => ({
    ...component,
    name: renamed.get(component.name) ?? component.name,
    schema: isRecord(component.schema)
      ? Object.fromEntries(
          Object.entries(component.schema).map(([key, field]) => [key, renameReferences(field)]),
        )
      : component.schema,
  }));
}

/** How often to check on a rename the space runs in the background. */
const RENAME_POLL_INTERVAL_MS = 2_000;
/** How long to wait for the space to rename a block in its stories. */
export const RENAME_TIMEOUT_MS = 10 * 60_000;
/**
 * How long the number of stories using the old name may stay the same before
 * the rename counts as stalled. A background rename can take up to about
 * 30 seconds to start.
 */
export const RENAME_STALL_MS = 60_000;

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
 * Runs a block update, and runs it again while the space refuses it because
 * it renames a block or field in the background.
 */
export async function whileRenameRuns<T>(update: () => Promise<T>, block: string): Promise<T> {
  const deadline = Date.now() + RENAME_TIMEOUT_MS;
  for (;;) {
    try {
      return await update();
    } catch (error) {
      if (!isRenameRunning(error)) throw error;
      if (Date.now() >= deadline) {
        throw new CommandError(
          `The space is still renaming a block or field in the background, so ${block} could not be updated. Wait until it finishes, then run schema push again.`,
        );
      }
      await delay(RENAME_POLL_INTERVAL_MS);
    }
  }
}

/** Whether a request failed without an HTTP answer, such as on a timeout or a dropped connection. */
function gotNoAnswer(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error.response)) return true;
  const { status } = error.response;
  return typeof status !== "number" || status <= 0;
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
  const client = getMapiClient();
  const path = { space_id: Number(space) };
  try {
    await whileRenameRuns(
      () =>
        client.components.update(id, {
          path,
          body: { component },
          query: { update_content: true },
          throwOnError: true,
        }),
      from,
    );
  } catch (error) {
    if (error instanceof CommandError || !gotNoAnswer(error)) throw error;
    // The space renames the block in the stories of a small space before it
    // answers, which can take longer than the client waits. It may still
    // have renamed the block.
    const name = await client.components.get(id, { path, throwOnError: true }).then(
      ({ data }) => data.component.name,
      () => undefined,
    );
    if (name === to) return;
    const state =
      name === undefined
        ? "the block could not be read back to check whether the space renamed it"
        : `the space still holds the block as ${name}`;
    throw new CommandError(
      `The request to rename ${from} to ${to} timed out or lost its connection, and ${state}. Run schema push again.`,
    );
  }
}

/**
 * Waits until no story uses the name a block had before `rename`. Returns the
 * number of stories that still do when the space stopped renaming them, which
 * it does without telling when the rename fails.
 */
export async function waitUntilStoriesRenamed(
  space: string,
  { from, to }: BlockRename,
  onWaiting?: (stories: number) => void,
): Promise<number> {
  const deadline = Date.now() + RENAME_TIMEOUT_MS;
  let stories = await countStoriesUsing(space, from);
  if (stories > 0) onWaiting?.(stories);
  let changedAt = Date.now();
  while (stories > 0) {
    if (Date.now() - changedAt >= RENAME_STALL_MS) return stories;
    if (Date.now() >= deadline) {
      throw new CommandError(
        `The space is still renaming ${from} to ${to} in the stories that use it. Wait until it finishes, then run schema push again to push the rest of the schema before you run content migrations.`,
      );
    }
    await delay(RENAME_POLL_INTERVAL_MS);
    const remaining = await countStoriesUsing(space, from);
    if (remaining < stories) changedAt = Date.now();
    stories = remaining;
  }
  return 0;
}
