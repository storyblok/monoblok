import { join } from 'node:path';
import { appendToFile, getComponentNameFromFilename, resolvePath } from '../../../utils/filesystem';
import type { StoryContent } from '../../stories/constants';
import { readFile } from 'node:fs/promises';
import { CommandError } from '../../../utils';

export interface RollbackDataStory {
  storyId: number;
  name: string;
  content: StoryContent;
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
 * @param options.migrationTimestamp - The timestamp when the migration started
 * @param options.migrationFile - Name of the migration file being applied
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
  story: { id: number; name: string; content: StoryContent };
  migrationTimestamp: number;
  migrationNames: string[];
}): Promise<void> {
  const rollbackData: RollbackDataStory = {
    storyId: story.id,
    name: story.name,
    content: story.content,
  };

  // Resolve the path for rollbacks
  const rollbacksPath = resolvePath(path, `migrations/${space}/rollbacks`);
  const componentNames = migrationNames.map(n => getComponentNameFromFilename(n));
  // Deduplicate component names and join the component names for final rollback name
  const rollbackName = [...new Set(componentNames)].join('~');
  const rollbackFileName = `${rollbackName}.${migrationTimestamp}.jsonl`;
  const rollbackFilePath = join(rollbacksPath, rollbackFileName);

  // Save the rollback data as JSONL
  await appendToFile(
    rollbackFilePath,
    JSON.stringify(rollbackData),
  );
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
    const filePath = rollbackFilePath.endsWith('.jsonl')
      ? rollbackFilePath
      : `${rollbackFilePath}.jsonl`;

    return {
      stories: (await readFile(filePath, 'utf-8')).trim().split('\n').filter(Boolean).map(x => JSON.parse(x)),
    };
  }
  catch (error) {
    throw new CommandError(`Failed to read rollback file: ${(error as Error).message}`);
  }
}
