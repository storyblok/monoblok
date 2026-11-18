import { resolvePath, saveToFile } from "../../../utils/filesystem";
import type { Component } from "../../components/constants";
import { join } from "pathe";
import type { WireComponent } from "@storyblok/schema/codegen";
import { handleFileSystemError } from "../../../utils";
import { discoverMigrations } from "@storyblok/schema";
import { buildMigrationFilename } from "../migration-filename";
import { migrationsDirectory } from "../content-migrations";
import { listChangesets, loadChangeset } from "../../schema/rollback/actions";
import { withRenamedBlocks } from "../../schema/push/block-renames";

const getMigrationTemplate = () => {
  return `export default function (block) {
  // Example to change a string to boolean
  // block.field_name = !!(block.field_name)

  // Example to transfer content from other field
  // block.target_field = block.source_field

  // Example to transform an array
  // block.array_field = block.array_field.map(item => ({ ...item, new_prop: 'value' }))

  return block;
}
`;
};

export const generateMigration = async (
  space: string,
  path: string | undefined,
  component: Pick<Component, "name">,
  suffix?: string,
): Promise<string> => {
  const resolvedPath = resolvePath(path, `migrations/${space}`);
  const migrationPath = join(resolvedPath, buildMigrationFilename(component.name, suffix));

  try {
    await saveToFile(migrationPath, getMigrationTemplate());
  } catch (error) {
    handleFileSystemError("write", error as Error);
  }

  return migrationPath;
};

/** A `schema push` that changed a block, as `migrations generate` reads it. */
export type PushChangingBlock = {
  timestamp: string;
  /** The space's components before the push, with the blocks it renamed under their new names. */
  components: WireComponent[];
  /** The name the push gave the block. */
  block: string;
  /** The ids of the content migrations the push wrote. */
  migrations: string[];
};

/**
 * The latest `schema push` to `space` that changed `block`, skipping pushes that
 * failed to change it. A push that renamed the block records it under its new
 * name and its pre-push state under the old one, so either name finds it.
 */
export async function latestPushChanging(
  path: string | undefined,
  space: string,
  block: string,
): Promise<PushChangingBlock | undefined> {
  for (const file of await listChangesets(resolvePath(path, ""))) {
    const changeset = await loadChangeset(file);
    if (String(changeset.spaceId) !== space) continue;
    const landed = changeset.changes.filter(
      (change) => change.type === "component" && !change.failed,
    );
    const nameBefore = (change: (typeof landed)[number]) =>
      typeof change.before?.name === "string" ? change.before.name : change.name;
    const match = landed.find((change) => change.name === block || nameBefore(change) === block);
    if (!match) continue;
    // The space renames a block in its stories along with the block.
    const renames = landed
      .map((change) => ({ from: nameBefore(change), to: change.name }))
      .filter(({ from, to }) => from !== to);
    return {
      timestamp: changeset.timestamp,
      components: withRenamedBlocks(changeset.remote.components, renames),
      block: match.name,
      migrations: changeset.migrations ?? [],
    };
  }
  return undefined;
}

const MIGRATION_TIMESTAMP = /^(\d{14})-/;

/**
 * Whether `space` holds a content migration created at or after `push`, going
 * by the `YYYYMMDDHHmmss` creation time its id starts with. The migrations the
 * push wrote itself don't count.
 */
export async function hasMigrationSince(
  path: string | undefined,
  space: string,
  push: Pick<PushChangingBlock, "timestamp" | "migrations">,
): Promise<boolean> {
  const since = new Date(push.timestamp).toISOString().replace(/\D/g, "").slice(0, 14);
  const migrations = await discoverMigrations(migrationsDirectory(path, space));
  return migrations.some(({ id }) => {
    const createdAt = MIGRATION_TIMESTAMP.exec(id)?.[1];
    return createdAt !== undefined && createdAt >= since && !push.migrations.includes(id);
  });
}
