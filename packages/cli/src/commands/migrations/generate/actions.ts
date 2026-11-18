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

/**
 * The latest `schema push` to `space` that changed `block`, skipping pushes that
 * failed to change it: when it ran, the
 * space's components before it, and the name the push gave the block. A push
 * that renamed the block records it under its new name and its pre-push state
 * under the old one, so either name finds it. The space renamed the block in
 * its stories along with the block, so the components hold it under its new
 * name.
 */
export async function latestPushChanging(
  path: string | undefined,
  space: string,
  block: string,
): Promise<{ timestamp: string; components: WireComponent[]; block: string } | undefined> {
  for (const file of await listChangesets(resolvePath(path, ""))) {
    const changeset = await loadChangeset(file);
    if (String(changeset.spaceId) !== space) continue;
    for (const change of changeset.changes) {
      if (change.type !== "component" || change.failed) continue;
      const nameBefore = typeof change.before?.name === "string" ? change.before.name : change.name;
      if (change.name === block || nameBefore === block) {
        return {
          timestamp: changeset.timestamp,
          components: withRenamedBlocks(changeset.remote.components, [
            { from: nameBefore, to: change.name },
          ]),
          block: change.name,
        };
      }
    }
  }
  return undefined;
}

const MIGRATION_TIMESTAMP = /^(\d{14})-/;

/**
 * Whether `space` holds a content migration created at or after `timestamp`,
 * going by the `YYYYMMDDHHmmss` creation time its id starts with.
 */
export async function hasMigrationSince(
  path: string | undefined,
  space: string,
  timestamp: string,
): Promise<boolean> {
  const since = new Date(timestamp).toISOString().replace(/\D/g, "").slice(0, 14);
  const migrations = await discoverMigrations(migrationsDirectory(path, space));
  return migrations.some(({ id }) => {
    const createdAt = MIGRATION_TIMESTAMP.exec(id)?.[1];
    return createdAt !== undefined && createdAt >= since;
  });
}
