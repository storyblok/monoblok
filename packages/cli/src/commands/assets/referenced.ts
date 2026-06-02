import { readdir, readFile } from 'node:fs/promises';
import { join } from 'pathe';

interface AssetLike {
  fieldtype?: string;
  id?: number;
}

/**
 * Recursively reads every `.json` story file under `directoryPath` and returns
 * the parsed objects. Returns an empty array when the directory does not exist.
 * Unparseable files are skipped.
 */
export async function readLocalStoryContents(directoryPath: string): Promise<{ content?: unknown }[]> {
  const stories: { content?: unknown }[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    }
    catch (maybeError) {
      if ((maybeError as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw maybeError;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      }
      else if (entry.name.endsWith('.json')) {
        try {
          stories.push(JSON.parse(await readFile(full, 'utf-8')) as { content?: unknown });
        }
        catch {
          // Skip files that are not valid story JSON.
        }
      }
    }
  };

  await walk(directoryPath);
  return stories;
}

/**
 * Recursively walks story content and collects the numeric IDs of asset
 * fields. Used by `assets pull --target=with-referenced` to discover which
 * assets a space's stories reference, so referenced shared-library assets can
 * be pulled alongside the space's own assets.
 *
 * Classification of those IDs into space-local vs. shared is done by the
 * caller (id-based, never via URL prefix — see spec §3).
 *
 * Boundary: only nodes carrying `fieldtype: 'asset'` with a numeric `id` are
 * collected (covers single- and multi-asset fields, including those nested in
 * bloks). Rich-text-embedded assets — image nodes (`type: 'image'`,
 * `attrs.id`) and asset links — do not use that shape and are NOT collected.
 */
export function collectReferencedAssetIds(stories: { content?: unknown }[]): Set<number> {
  const ids = new Set<number>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    const obj = node as AssetLike & Record<string, unknown>;
    if (obj.fieldtype === 'asset' && typeof obj.id === 'number') {
      ids.add(obj.id);
    }
    for (const value of Object.values(obj)) {
      visit(value);
    }
  };

  for (const story of stories) {
    visit(story.content);
  }

  return ids;
}
