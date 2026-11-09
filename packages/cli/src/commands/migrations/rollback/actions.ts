import { join } from "pathe";
import {
  appendToFile,
  fileExists,
  getComponentNameFromFilename,
  resolvePath,
} from "../../../utils/filesystem";
import type { BlokContent } from "../../stories/constants";
import { readdir, readFile } from "node:fs/promises";
import { CommandError } from "../../../utils";

export interface RollbackDataStory {
  storyId: number;
  name: string;
  content: BlokContent;
  published?: boolean;
  unpublished_changes?: boolean;
}

export interface RollbackData {
  stories: RollbackDataStory[];
}

/**
 * Save the rollback data for a migration
 * @param options - Options for saving rollback data
 * @param options.space - The space ID
 * @param options.path - Base path for saving rollback data
 * @param options.story - Story with their original content
 * @param options.story.id - Story ID
 * @param options.story.name - Story name
 * @param options.story.content - Story content
 * @param options.story.published - Story publication status
 * @param options.story.unpublished_changes - Story unpublished changes status
 * @param options.migrationTimestamp - The timestamp when the migration started
 * @param options.migrationNames - Names of the migration files being applied
 */
export async function saveRollbackData({
  space,
  path,
  story,
  migrationTimestamp,
  migrationNames,
}: {
  space: string;
  path: string;
  story: {
    id: number;
    name: string;
    content: BlokContent;
    published?: boolean;
    unpublished_changes?: boolean;
  };
  migrationTimestamp: number;
  migrationNames: string[];
}): Promise<void> {
  const rollbackData: RollbackDataStory = {
    storyId: story.id,
    name: story.name,
    content: story.content,
    published: story.published,
    unpublished_changes: story.unpublished_changes,
  };

  // Resolve the path for rollbacks
  const rollbacksPath = resolvePath(path, `migrations/${space}/rollbacks`);
  const componentNames = migrationNames.map((n) => getComponentNameFromFilename(n));
  // Deduplicate component names and join the component names for final rollback name
  const rollbackName = [...new Set(componentNames)].join("~");
  const rollbackFileName = `${rollbackName}.${migrationTimestamp}.jsonl`;
  const rollbackFilePath = join(rollbacksPath, rollbackFileName);

  // Save the rollback data as JSONL
  await appendToFile(rollbackFilePath, JSON.stringify(rollbackData));
}

/**
 * Read rollback data from a file
 * @param options - Options for reading rollback data
 * @param options.space - The space ID
 * @param options.path - Base path for rollback files
 * @param options.migrationFile - Name of the migration file to rollback
 * @returns The rollback data containing stories to restore
 */
export async function readRollbackFile({
  space,
  path,
  migrationFile,
}: {
  space: string;
  path: string;
  migrationFile: string;
}): Promise<RollbackData> {
  try {
    const resolvedPath = resolvePath(path, `migrations/${space}/rollbacks`);
    const rollbackFilePath = join(resolvedPath, migrationFile);

    // Read the rollback file
    const filePath = rollbackFilePath.endsWith(".jsonl")
      ? rollbackFilePath
      : `${rollbackFilePath}.jsonl`;

    return {
      stories: (await readFile(filePath, "utf-8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((x) => JSON.parse(x)),
    };
  } catch (error) {
    throw new CommandError(`Failed to read rollback file: ${(error as Error).message}`);
  }
}

const ROLLBACK_FILE_EXTENSION = ".jsonl";

function rollbacksDirectory(space: string, path: string | undefined): string {
  return resolvePath(path, `migrations/${space}/rollbacks`);
}

/** Whether `name` names a rollback file of migration functions, with or without its extension. */
export async function isRollbackFile({
  space,
  path,
  name,
}: {
  space: string;
  path: string | undefined;
  name: string;
}): Promise<boolean> {
  const file = name.endsWith(ROLLBACK_FILE_EXTENSION) ? name : `${name}${ROLLBACK_FILE_EXTENSION}`;
  return fileExists(join(rollbacksDirectory(space, path), file));
}

export interface RollbackFile {
  /** The file name without its extension, as `rollback` takes it. */
  name: string;
  createdAt: Date;
  stories: number;
}

/** The rollback files that runs of migration functions wrote for a space, oldest first. */
export async function listRollbackFiles({
  space,
  path,
}: {
  space: string;
  path: string | undefined;
}): Promise<RollbackFile[]> {
  const directory = rollbacksDirectory(space, path);
  const files = (await readdir(directory).catch((): string[] => [])).filter((file) =>
    file.endsWith(ROLLBACK_FILE_EXTENSION),
  );
  const rollbackFiles = await Promise.all(
    files.map(async (file) => {
      const name = file.slice(0, -ROLLBACK_FILE_EXTENSION.length);
      const timestamp = Number(name.split(".").pop());
      // Files renamed by hand lose the timestamp the run wrote; they sort first.
      const lines = (await readFile(join(directory, file), "utf-8")).split("\n").filter(Boolean);
      return {
        name,
        createdAt: new Date(Number.isFinite(timestamp) ? timestamp : 0),
        stories: lines.length,
      };
    }),
  );
  return rollbackFiles.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
