import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

export async function readLocalJsonFiles<T>(dir: string): Promise<T[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const jsonFiles = files.filter(f => extname(f) === '.json');

  const items = await Promise.all(
    jsonFiles.map(async (file) => {
      const filePath = join(dir, file);
      const content = await readFile(filePath, 'utf8');
      try {
        return JSON.parse(content) as T;
      }
      catch (error: unknown) {
        throw new Error(
          `Failed to parse ${filePath}: ${(error as Error).message}`,
        );
      }
    }),
  );

  return items;
}

export async function writeLocalJsonFile(
  dir: string,
  filename: string,
  data: unknown,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, filename);
  await writeFile(filePath, JSON.stringify(data, undefined, 2), 'utf8');
}
