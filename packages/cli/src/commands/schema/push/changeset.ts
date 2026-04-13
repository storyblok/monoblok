import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'pathe';

import type { ChangesetData } from '../types';

/** Creates a filesystem-safe timestamp string for file names. */
function fileTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

/** Ensures a directory exists, creating it recursively if needed. */
async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Saves a changeset recording what was pushed and the full pre-push remote state for rollback. Returns the written file path. */
export async function saveChangeset(basePath: string, data: ChangesetData): Promise<string> {
  const dir = join(basePath, 'schema', 'changesets');
  await ensureDir(dir);
  const fileName = `${fileTimestamp(data.timestamp)}.json`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}
