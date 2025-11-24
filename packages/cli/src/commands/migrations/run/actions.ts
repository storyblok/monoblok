import { readdir } from 'node:fs/promises';
import { importModule, resolvePath } from '../../../utils/filesystem';
import { FileSystemError, toError } from '../../../utils/error';
import { join } from 'node:path';
import { ERROR_CODES, type MigrationFile, type ReadMigrationFilesOptions } from './constants';
import { createRegexFromGlob } from '../../../utils';
import type { StoryContent } from '../../stories/constants';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../utils/logger';

export async function readMigrationFiles(options: ReadMigrationFilesOptions): Promise<MigrationFile[]> {
  const { space, path, filter } = options;
  const resolvedPath = resolvePath(path, `migrations/${space}`);

  try {
    const dirFiles = await readdir(resolvedPath);
    const migrationFiles: MigrationFile[] = [];
    const filterRegex = filter ? createRegexFromGlob(filter) : null;

    if (dirFiles.length > 0) {
      for (const file of dirFiles) {
        if (!file.endsWith('.js')) {
          continue;
        }

        // Apply glob filter if provided
        if (filterRegex && !filterRegex.test(file)) {
          continue;
        }

        migrationFiles.push({
          name: file,
        });
      }
    }

    return migrationFiles;
  }
  catch (error) {
    const message = `No directory found for space "${space}". Please make sure you have generated migrations first by running:\n\n  storyblok migrations generate YOUR_COMPONENT_NAME --space ${space}`;
    throw new FileSystemError(
      'file_not_found',
      'read',
      error as Error,
      message,
    );
  }
}

/**
 * Loads a migration function from a file using dynamic import
 * @param fileName - The name of the migration file
 * @param space - The space ID
 * @param basePath - The base path for migrations
 * @returns The migration function or null if loading failed
 */
export async function getMigrationFunction(fileName: string, space: string, basePath: string): Promise<((block: any) => any) | null> {
  try {
    const resolvedPath = resolvePath(basePath, `migrations/${space}`);
    const filePath = join(resolvedPath, fileName);
    const migrationModule = await importModule(filePath);

    // Get the default export which should be the migration function
    if (typeof migrationModule.default === 'function') {
      return migrationModule.default;
    }

    getUI().error(`Migration file "${fileName}" does not export a default function.`);
    getLogger().error('Migration file does not export a default function', {
      fileName,
      errorCode: ERROR_CODES.MIGRATION_FILE_NO_DEFAULT_EXPORT,
    });
    return null;
  }
  catch (maybeError) {
    const error = toError(maybeError);
    getUI().error(`Error loading migration function from "${fileName}": ${error.message}`);
    getLogger().error('Couldn\'t load migration function', {
      fileName,
      error,
      errorCode: ERROR_CODES.MIGRATION_LOAD_ERROR,
    });
    return null;
  }
}

/**
 * Recursively applies a migration function to all blocks in a content object that match the target component
 * @param content - The content object to process
 * @param migrationFunction - The migration function to apply
 * @param targetComponent - The component name to target for migration
 * @returns Whether any blocks were modified
 */
export function applyMigrationToAllBlocks(content: StoryContent, migrationFunction: (block: StoryContent) => StoryContent, targetComponent: string): boolean {
  let processed = false;

  if (!content || typeof content !== 'object') {
    return processed;
  }

  // Get the base component name (everything before the first dot)
  const baseTargetComponent = targetComponent.split('.')[0];

  // If the content has a component property and it matches the base component name
  let migratedContent = null;
  if (content.component === baseTargetComponent) {
    migratedContent = migrationFunction({ ...content });
    processed = true;
  }

  const uniqueKeys = new Set([...Object.keys(content), ...Object.keys(migratedContent || {})]);
  for (const key of uniqueKeys) {
    if (migratedContent) {
      if (!(key in migratedContent)) {
        delete content[key];
        continue;
      }
      content[key] = migratedContent[key];
    }

    // Recursively process all properties that might contain nested blocks
    // Process arrays (might contain blocks)
    if (Array.isArray(content[key])) {
      for (const value of content[key]) {
        if (value && typeof value === 'object') {
          const blockProcessed = applyMigrationToAllBlocks(value, migrationFunction, targetComponent);
          processed = processed || blockProcessed;
        }
      }
    }
    // Process nested objects (might be blocks)
    else if (content[key] && typeof content[key] === 'object') {
      const blockProcessed = applyMigrationToAllBlocks(content[key], migrationFunction, targetComponent);
      processed = processed || blockProcessed;
    }
  }

  return processed;
}
