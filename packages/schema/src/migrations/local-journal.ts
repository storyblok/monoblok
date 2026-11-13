/**
 * The default journal: two files per run in a `rollbacks` directory beside each
 * space's migration files, so reading the ledger never loads the patches.
 *
 * Run ids sort chronologically, which is what lets `list` return runs in the
 * order they happened without opening every entry.
 */
import type { Journal, MigrationRun } from "./journal";
import { MigrationError } from "./migration-error";
import { joinPath } from "../utils/join-path";

const PATCHES_SUFFIX = ".patches.json";
const ROLLBACKS_DIRECTORY = "rollbacks";
/**
 * Recorded runs describe one machine's view of a space, so they never belong in
 * version control. Only the journal's own files are ignored, so other files
 * kept in the directory stay as visible to git as they were.
 */
const IGNORE_JOURNAL_FILES = "*.json\n.gitignore\n";
/** Run ids and space ids become file and directory names, so they may not name a path. */
const PATH_SEGMENT = /^[\w-]+$/;

/** Loaded on first use, so importing this module needs no filesystem. */
const fs = () => import("node:fs/promises");

/** Journal files are only ever written by `record`, so their shape is trusted once they parse. */
async function readJson<T>(file: string): Promise<T> {
  const text = await (await fs()).readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MigrationError(`Migration journal file ${file} is not valid JSON.`, { cause: error });
  }
}

function assertSegment(kind: string, value: string): void {
  if (!PATH_SEGMENT.test(value)) {
    throw new MigrationError(
      `Invalid ${kind} "${value}": only letters, digits, "_" and "-" are allowed.`,
    );
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * A journal for the migrations kept in `migrationsDirectory`, with one
 * directory per space. Runs are stored in `<space>/rollbacks/`.
 */
export function localJournal(migrationsDirectory: string): Journal {
  const root = migrationsDirectory;
  const rollbacksDir = (space: string) => joinPath(root, space, ROLLBACKS_DIRECTORY);
  const entryPath = (space: string, id: string) => joinPath(rollbacksDir(space), `${id}.json`);
  const patchPath = (space: string, id: string) =>
    joinPath(rollbacksDir(space), `${id}${PATCHES_SUFFIX}`);

  /** The space a run id belongs to is not in the id, so a lookup scans spaces. */
  async function locate(id: string): Promise<string | undefined> {
    if (!PATH_SEGMENT.test(id)) return undefined;
    const { readdir } = await fs();
    for (const space of await readdir(root).catch((): string[] => [])) {
      const entries = await readdir(rollbacksDir(space)).catch((): string[] => []);
      if (entries.includes(`${id}.json`)) return space;
    }
    return undefined;
  }

  return {
    async record(run, inverse) {
      assertSegment("space", run.space);
      assertSegment("run id", run.id);
      const { mkdir, writeFile } = await fs();
      await mkdir(rollbacksDir(run.space), { recursive: true });
      await writeFile(joinPath(rollbacksDir(run.space), ".gitignore"), IGNORE_JOURNAL_FILES);
      await writeFile(patchPath(run.space, run.id), JSON.stringify(inverse));
      await writeFile(entryPath(run.space, run.id), JSON.stringify(run, null, 2));
    },

    async remove(id) {
      const space = await locate(id);
      if (!space) return;
      const { rm } = await fs();
      await rm(entryPath(space, id), { force: true });
      await rm(patchPath(space, id), { force: true });
    },

    async list(space) {
      assertSegment("space", space);
      const { readdir } = await fs();
      const files = await readdir(rollbacksDir(space)).catch((): string[] => []);
      const entries = files.filter(
        (file) => file.endsWith(".json") && !file.endsWith(PATCHES_SUFFIX),
      );
      return Promise.all(
        entries.sort().map((file) => readJson<MigrationRun>(joinPath(rollbacksDir(space), file))),
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
      const file = patchPath(space, id);
      return readJson<Awaited<ReturnType<Journal["readInverse"]>>>(file).catch((error) => {
        if (!isMissingFile(error)) throw error;
        throw new MigrationError(`Run ${id} has no recorded patches; expected ${file}.`, {
          cause: error,
        });
      });
    },
  };
}
