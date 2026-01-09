import { join, parse, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendFile, mkdir, readdir, readFile as readFileImpl, writeFile } from 'node:fs/promises';
import { handleFileSystemError } from './error/filesystem-error';
import type { FileReaderResult } from '../types';
import filenamify from 'filenamify';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Sema } from 'async-sema';
import { toError } from './error';

// Default working folder for commands that do not pass --path explicitly.
export const DEFAULT_STORAGE_DIR = '.storyblok';

export interface FileOptions {
  mode?: number;
}

export const getStoryblokGlobalPath = () => {
  const homeDirectory = process.env[
    process.platform.startsWith('win') ? 'USERPROFILE' : 'HOME'
  ] || process.cwd();

  return join(homeDirectory, '.storyblok');
};

export const saveToFile = async (filePath: string, data: string | NodeJS.ArrayBufferView, options?: FileOptions) => {
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

export const saveToFileSync = (filePath: string, data: string | NodeJS.ArrayBufferView, options?: FileOptions) => {
  const resolvedPath = parse(filePath).dir;

  // Only attempt to create a directory if there's a directory part
  if (resolvedPath) {
    try {
      mkdirSync(resolvedPath, { recursive: true });
    }
    catch (mkdirError) {
      handleFileSystemError('mkdir', mkdirError as Error);
      return; // Exit early if the directory creation fails
    }
  }

  try {
    writeFileSync(filePath, data, options as any);
  }
  catch (writeError) {
    handleFileSystemError('write', writeError as Error);
  }
};

const writeLocks = new Map<string, Sema>();
const getWriteLock = (fullPath: string) => {
  const writeLock = writeLocks.get(fullPath);
  if (writeLock) {
    return writeLock;
  }
  const newWriteLock = new Sema(1);
  writeLocks.set(fullPath, newWriteLock);
  return newWriteLock;
};
const acquireWriteLock = (fullPath: string) => {
  return getWriteLock(fullPath).acquire();
};
const releaseWriteLock = (fullPath: string) => {
  return getWriteLock(fullPath).release();
};

export const appendToFile = async (filePath: string, data: string, options?: FileOptions) => {
  try {
    await acquireWriteLock(filePath);
    const resolvedPath = parse(filePath).dir;
    await mkdir(resolvedPath, { recursive: true });
    const dataWithNewline = data.endsWith('\n') ? data : `${data}\n`;
    await appendFile(filePath, dataWithNewline, options);
  }
  catch (maybeError) {
    const error = toError(maybeError);
    handleFileSystemError(
      'syscall' in error && error.syscall === 'mkdir' ? 'mkdir' : 'write',
      error,
    );
  }
  finally {
    await releaseWriteLock(filePath);
  }
};

export const appendToFileSync = (filePath: string, data: string, options?: FileOptions) => {
  const resolvedPath = parse(filePath).dir;

  // Ensure the directory exists
  try {
    mkdirSync(resolvedPath, { recursive: true });
  }
  catch (mkdirError) {
    handleFileSystemError('mkdir', mkdirError as Error);
    return;
  }

  try {
    const dataWithNewline = data.endsWith('\n') ? data : `${data}\n`;
    appendFileSync(filePath, dataWithNewline, options);
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
  const basePath = path ?? DEFAULT_STORAGE_DIR;
  // Keeps honoring relative paths by anchoring everything on the current workspace root.
  return resolve(process.cwd(), basePath, folder);
};

/**
 * Resolves the absolute path for a specific command directory.
 *
 * If a `space` is provided, it is appended to the `commandPath` before resolution.
 *
 * @param commandPath - The relative path or name of the command category.
 * @param space - (Optional).
 * @param baseDir - (Optional) The base directory to resolve against.
 * @returns The fully resolved absolute path string.
 */
export function resolveCommandPath(commandPath: string, space?: string, baseDir?: string) {
  if (space) {
    return resolvePath(baseDir, join(commandPath, space));
  }
  return resolvePath(baseDir, commandPath);
}

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

export async function readDirectory(directoryPath: string) {
  try {
    const files = await readdir(directoryPath);
    return files;
  }
  catch (maybeError) {
    handleFileSystemError('read', toError(maybeError));
    return [];
  }
}

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

export function importModule(filePath: string) {
  return import(pathToFileURL(filePath).href);
}
