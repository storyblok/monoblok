import { readFile } from 'node:fs/promises';

export interface ManifestEntry {
  old_id: string | number;
  new_id: string | number;
  old_filename?: string;
  new_filename?: string;
  created_at?: string;
}

export const loadManifest = async (
  manifestFile: string,
): Promise<ManifestEntry[]> => {
  return readFile(manifestFile, 'utf8')
    .then(manifest => manifest.split('\n').filter(Boolean).map(entry => JSON.parse(entry)))
    .catch((error: NodeJS.ErrnoException) => {
      if (error && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    });
};
