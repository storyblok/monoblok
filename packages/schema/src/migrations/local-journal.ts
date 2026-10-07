/**
 * The default journal: a directory per space, two files per run, so reading the
 * ledger never loads the patches.
 *
 * Run ids sort chronologically, which is what lets `list` return runs in the
 * order they happened without opening every entry.
 */
import type { Journal, MigrationRun } from "./journal";
import { MigrationError } from "./migration-error";
import { joinPath } from "../utils/join-path";

const PATCHES_SUFFIX = ".patches.json";
/** Sits beside the space directories that hold the migration files themselves. */
export const JOURNAL_DIRECTORY = ".journal";
/** Recorded runs describe one machine's view of a space, so they never belong in version control. */
const IGNORE_EVERYTHING = "*\n";
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
 * A journal stored in `journalDirectory`. The directory is git-ignored as a
 * whole when it is named {@link JOURNAL_DIRECTORY}; {@link resolveJournal}
 * picks that directory inside a migrations directory.
 */
export function localJournal(journalDirectory: string): Journal {
  const root = journalDirectory;
  const ignoresItself =
    root
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() === JOURNAL_DIRECTORY;
  const spaceDir = (space: string) => joinPath(root, space);
  const entryPath = (space: string, id: string) => joinPath(spaceDir(space), `${id}.json`);
  const patchPath = (space: string, id: string) =>
    joinPath(spaceDir(space), `${id}${PATCHES_SUFFIX}`);

  /** The space a run id belongs to is not in the id, so a lookup scans spaces. */
  async function locate(id: string): Promise<string | undefined> {
    if (!PATH_SEGMENT.test(id)) return undefined;
    const { readdir } = await fs();
    for (const space of await readdir(root).catch((): string[] => [])) {
      const entries = await readdir(spaceDir(space)).catch((): string[] => []);
      if (entries.includes(`${id}.json`)) return space;
    }
    return undefined;
  }

  return {
    async record(run, inverse) {
      assertSegment("space", run.space);
      assertSegment("run id", run.id);
      const { mkdir, writeFile } = await fs();
      await mkdir(spaceDir(run.space), { recursive: true });
      if (ignoresItself) await writeFile(joinPath(root, ".gitignore"), IGNORE_EVERYTHING);
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
      const files = await readdir(spaceDir(space)).catch((): string[] => []);
      const entries = files.filter(
        (file) => file.endsWith(".json") && !file.endsWith(PATCHES_SUFFIX),
      );
      return Promise.all(
        entries.sort().map((file) => readJson<MigrationRun>(joinPath(spaceDir(space), file))),
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

/** The journal for the migrations kept in `migrationsDirectory`. */
export function resolveJournal(migrationsDirectory: string): Journal {
  return localJournal(joinPath(migrationsDirectory, JOURNAL_DIRECTORY));
}
