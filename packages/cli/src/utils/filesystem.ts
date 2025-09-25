import { join, parse, resolve } from 'node:path';
import { appendFile, mkdir, readFile as readFileImpl, writeFile } from 'node:fs/promises';
import { handleFileSystemError } from './error/filesystem-error';
import type { FileReaderResult } from '../types';
import filenamify from 'filenamify';

export interface FileOptions {
  mode?: number;
}

export const getStoryblokGlobalPath = () => {
  const homeDirectory = process.env[
    process.platform.startsWith('win') ? 'USERPROFILE' : 'HOME'
  ] || process.cwd();

  return join(homeDirectory, '.storyblok');
};

export const saveToFile = async (filePath: string, data: string, options?: FileOptions) => {
  // Get the directory path
  const resolvedPath = parse(filePath).dir;

  // Ensure the directory exists
  try {
    await mkdir(resolvedPath, { recursive: true });
  }
  catch (mkdirError) {
    handleFileSystemError('mkdir', mkdirError as Error);
    return; // Exit early if the directory creation fails
  }

  // Write the file
  try {
    await writeFile(filePath, data, options);
  }
  catch (writeError) {
    handleFileSystemError('write', writeError as Error);
  }
};

export const appendToFile = async (filePath: string, data: string, options?: FileOptions) => {
  const resolvedPath = parse(filePath).dir;

  // Ensure the directory exists
  try {
    await mkdir(resolvedPath, { recursive: true });
  }
  catch (mkdirError) {
    handleFileSystemError('mkdir', mkdirError as Error);
    return;
  }
  try {
    const dataWithNewline = data.endsWith('\n') ? data : `${data}\n`;
    await appendFile(filePath, dataWithNewline, options);
  }
  catch (writeError) {
    handleFileSystemError('write', writeError as Error);
  }
};

export const readFile = async (filePath: string) => {
  try {
    return await readFileImpl(filePath, 'utf8');
  }
  catch (error) {
    handleFileSystemError('read', error as Error);
    return '';
  }
};

export const resolvePath = (path: string | undefined, folder: string) => {
  // If a custom path is provided, append the folder structure to it
  if (path) {
    return resolve(process.cwd(), path, folder);
  }
  // Otherwise use the default .storyblok path
  return resolve(resolve(process.cwd(), '.storyblok'), folder);
};

/**
 * Extracts the component name from a migration filename
 * @param filename - The migration filename (e.g., "simple_component.js")
 * @returns The component name (e.g., "simple_component")
 */
export const getComponentNameFromFilename = (filename: string): string => {
  // Remove the .js extension
  return filename.replace(/\.js$/, '');
};

/**
 * Sanitizes a string to be safe for use as a filename by removing/replacing problematic characters
 * https://github.com/parshap/node-sanitize-filename/blob/master/index.js
 * @param filename - The filename to sanitize
 * @returns A safe filename string
 */
export const sanitizeFilename = (filename: string): string => {
  return filenamify(filename, {
    replacement: '_',
  });
};

export async function readJsonFile<T>(filePath: string): Promise<FileReaderResult<T>> {
  try {
    const content = (await readFile(filePath)).toString();
    if (!content) {
      return { data: [] };
    }
    const parsed = JSON.parse(content);
    return { data: Array.isArray(parsed) ? parsed : [parsed] };
  }
  catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Recursively copy a directory and its contents
 * @param src - Source directory path
 * @param dest - Destination directory path
 * @param options - Copy options
 * @param options.skipNodeModules - Whether to skip node_modules directories (default: true)
 */
export async function copyDirectory(src: string, dest: string, options: { skipNodeModules?: boolean } = {}): Promise<void> {
  const { mkdir, readdir, copyFile } = await import('node:fs/promises');
  const { join } = await import('node:path');

  try {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules by default to avoid dependency conflicts and socket errors
      if (options.skipNodeModules !== false && entry.name === 'node_modules') {
        continue;
      }

      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      try {
        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath, options);
        }
        else if (entry.isFile()) {
          await copyFile(srcPath, destPath);
        }
        // Skip other types (sockets, pipes, etc.) that can't be copied
      }
      catch (error: any) {
        // Log the error but continue with other files
        console.warn(`Failed to copy ${srcPath}: ${error.message}`);
      }
    }
  }
  catch (error) {
    handleFileSystemError('mkdir', error as Error);
  }
}

/**
 * Recursively remove a directory and its contents
 * @param dir - Directory path to remove
 */
export async function removeDirectory(dir: string): Promise<void> {
  const { rm } = await import('node:fs/promises');

  try {
    await rm(dir, { recursive: true, force: true });
  }
  catch {
    // Directory doesn't exist or permission error, ignore
  }
}
