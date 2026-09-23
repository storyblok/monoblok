/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * The default journal: a directory per space under `.storyblok/migrations`.
 * Two files per run, so reading the ledger never loads the patches.
 *
 * Run ids sort chronologically, which is what lets `list` return runs in the
 * order they happened without opening every entry.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Journal } from "./journal";

const PATCHES_SUFFIX = ".patches.json";

export function runId(migration: string, at = new Date()): string {
  return `${at.toISOString().replace(/[:.]/g, "-")}-${migration}`;
}

export function localJournal(root = ".storyblok/migrations"): Journal {
  const spaceDir = (space: string) => path.join(root, space);
  const entryPath = (space: string, id: string) => path.join(spaceDir(space), `${id}.json`);
  const patchPath = (space: string, id: string) =>
    path.join(spaceDir(space), `${id}${PATCHES_SUFFIX}`);

  /** The space a run id belongs to is not in the id, so a lookup scans spaces. */
  async function locate(id: string): Promise<string | undefined> {
    for (const space of await readdir(root).catch((): string[] => [])) {
      const entries = await readdir(spaceDir(space)).catch((): string[] => []);
      if (entries.includes(`${id}.json`)) return space;
    }
    return undefined;
  }

  return {
    async record(run, inverse) {
      await mkdir(spaceDir(run.space), { recursive: true });
      await writeFile(patchPath(run.space, run.id), JSON.stringify(inverse));
      await writeFile(entryPath(run.space, run.id), JSON.stringify(run, null, 2));
    },

    async list(space) {
      const files = await readdir(spaceDir(space)).catch((): string[] => []);
      const entries = files.filter(
        (file) => file.endsWith(".json") && !file.endsWith(PATCHES_SUFFIX),
      );
      return Promise.all(
        entries
          .sort()
          .map(async (file) =>
            JSON.parse(await readFile(path.join(spaceDir(space), file), "utf8")),
          ),
      );
    },

    async read(id) {
      const space = await locate(id);
      if (!space) return undefined;
      return JSON.parse(await readFile(entryPath(space, id), "utf8"));
    },

    async readInverse(id) {
      const space = await locate(id);
      if (!space) return [];
      return JSON.parse(await readFile(patchPath(space, id), "utf8"));
    },
  };
}
