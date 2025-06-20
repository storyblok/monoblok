import { readdir, readFile } from 'node:fs/promises';
import { resolvePath } from '../../../utils/filesystem';
import { FileSystemError } from '../../../utils/error';
import { join } from 'node:path';
import type { MigrationFile, ReadMigrationFilesOptions } from './constants';
import { createRegexFromGlob, konsola } from '../../../utils';
import type { StoryContent } from '../../stories/constants';

export async function readJavascriptFile(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8');
    if (!content) {
      throw new FileSystemError('invalid_argument', 'read', new Error(`File ${filePath} is empty`));
    }
    return content;
  }
  catch (error) {
    throw new FileSystemError('file_not_found', 'read', error as Error);
  }
}

export async function readMigrationFiles(options: ReadMigrationFilesOptions): Promise<MigrationFile[]> {
  const { space, path, filter } = options;
  const resolvedPath = resolvePath(path, `migrations/${space}`);

  // Check if directory exists first
  try {
    await readdir(resolvedPath);
  }
  catch (error) {
    const message = `No directory found for space "${space}". Please make sure you have pulled the migrations first by running:\n\n  storyblok migrations pull --space ${space}`;
    throw new FileSystemError(
      'file_not_found',
      'read',
      error as Error,
      message,
    );
  }

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

        const filePath = join(resolvedPath, file);
        const content = await readJavascriptFile(filePath);

        migrationFiles.push({
          name: file,
          content,
        });
      }
    }

    return migrationFiles;
  }
  catch (error) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      error as Error,
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

    // Use dynamic import to load the module
    const migrationModule = await import(`file://${filePath}`);

    // Get the default export which should be the migration function
    if (typeof migrationModule.default === 'function') {
      return migrationModule.default;
    }

    konsola.error(`Migration file "${fileName}" does not export a default function.`);
    return null;
  }
  catch (error) {
    konsola.error(`Error loading migration function from "${fileName}": ${(error as Error).message}`);
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
  if (!content || typeof content !== 'object') {
    return false;
  }

  let modified = false;

  // Get the base component name (everything before the first dot)
  const baseTargetComponent = targetComponent.split('.')[0];

  // If the content has a component property and it matches the base component name
  if (content.component === baseTargetComponent) {
    // Apply the migration function to this block
    const migratedContent = migrationFunction({ ...content });
    Object.assign(content, migratedContent);
    modified = true;
  }

  // Recursively process all properties that might contain nested blocks
  for (const key in content) {
    if (Object.prototype.hasOwnProperty.call(content, key)) {
      const value = content[key];

      // Process arrays (might contain blocks)
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (value[i] && typeof value[i] === 'object') {
            const blockModified = applyMigrationToAllBlocks(value[i], migrationFunction, targetComponent);
            modified = modified || blockModified;
          }
        }
      }
      // Process nested objects (might be blocks)
      else if (value && typeof value === 'object') {
        const blockModified = applyMigrationToAllBlocks(value, migrationFunction, targetComponent);
        modified = modified || blockModified;
      }
    }
  }

  return modified;
}
