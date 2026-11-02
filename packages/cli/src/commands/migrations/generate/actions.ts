import { resolvePath, saveToFile } from "../../../utils/filesystem";
import type { Component } from "../../components/constants";
import { join } from "pathe";
import { handleFileSystemError } from "../../../utils";
import { buildMigrationFilename } from "../migration-filename";
import { listChangesets, loadChangeset } from "../../schema/rollback/actions";

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
  component: Component,
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

/** The pre-push space state of the latest `schema push` to `space` that changed `block`. */
export async function latestPushChanging(
  path: string | undefined,
  space: string,
  block: string,
): Promise<{ timestamp: string; components: Component[] } | undefined> {
  for (const file of await listChangesets(resolvePath(path, ""))) {
    const changeset = await loadChangeset(file);
    if (String(changeset.spaceId) !== space) continue;
    if (changeset.changes.some((change) => change.type === "component" && change.name === block)) {
      return { timestamp: changeset.timestamp, components: changeset.remote.components };
    }
  }
  return undefined;
}
