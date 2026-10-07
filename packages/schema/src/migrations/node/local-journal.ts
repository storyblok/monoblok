/**
 * The default journal: a directory per space, two files per run, so reading the
 * ledger never loads the patches.
 *
 * Run ids sort chronologically, which is what lets `list` return runs in the
 * order they happened without opening every entry.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Journal, MigrationRun } from "../journal";

const PATCHES_SUFFIX = ".patches.json";
/** Sits beside the space directories that hold the migration files themselves. */
export const JOURNAL_DIRECTORY = ".journal";
/** Recorded runs describe one machine's view of a space, so they never belong in version control. */
const IGNORE_EVERYTHING = "*\n";

/** Journal files are only ever written by `record`, so their shape is trusted once they parse. */
async function readJson<T>(file: string): Promise<T> {
  const text = await readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Migration journal file ${file} is not valid JSON.`, { cause: error });
  }
}

export function localJournal(root: string): Journal {
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
      await writeFile(path.join(root, ".gitignore"), IGNORE_EVERYTHING);
      await writeFile(patchPath(run.space, run.id), JSON.stringify(inverse));
      await writeFile(entryPath(run.space, run.id), JSON.stringify(run, null, 2));
    },

    async list(space) {
      const files = await readdir(spaceDir(space)).catch((): string[] => []);
      const entries = files.filter(
        (file) => file.endsWith(".json") && !file.endsWith(PATCHES_SUFFIX),
      );
      return Promise.all(
        entries.sort().map((file) => readJson<MigrationRun>(path.join(spaceDir(space), file))),
      );
    },

    async read(id) {
      const space = await locate(id);
      if (!space) return undefined;
      return readJson(entryPath(space, id));
    },

    async readInverse(id) {
      const space = await locate(id);
      if (!space) return [];
      return readJson(patchPath(space, id));
    },
  };
}

/** The journal for the migrations kept in `migrationsDirectory`. */
export function resolveJournal(migrationsDirectory: string): Journal {
  return localJournal(path.join(migrationsDirectory, JOURNAL_DIRECTORY));
}
