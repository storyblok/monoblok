/**
 * Discovers content migration files in a space's migrations directory.
 *
 * Identity is the filename, not anything inside the file, so the same
 * migration has the same id on every machine. The name pattern admits no dots,
 * so the `*.before.ts` schema snapshots that sit beside migrations, and
 * anything else in the directory, are left alone.
 */
import type { CompiledMigration } from "./define-migration";
import { MigrationError } from "./migration-error";
import { isRecord } from "../utils/is-record";
import { joinPath } from "../utils/join-path";

export type MigrationFile = {
  /** Filename without its extension; the migration's identity. */
  id: string;
  file: string;
};

export type LoadedMigration = MigrationFile & {
  migration: CompiledMigration;
};

/**
 * Resolves a migration file to its default export. Supplied by the caller,
 * because loading TypeScript at runtime needs a loader this package does not
 * ship.
 */
export type ImportDefault = (file: string) => Promise<unknown>;

const MIGRATION_FILE = /^((\d+)-[a-z0-9-]+)\.(?:ts|js|mjs)$/;

function isCompiledMigration(value: unknown): value is CompiledMigration {
  return isRecord(value) && Array.isArray(value.ops) && Array.isArray(value.targets);
}

/** Compares digit strings by value, so `9` sorts before `10` however long either is. */
function compareNumeric(a: string, b: string): number {
  const left = a.replace(/^0+(?=\d)/, "");
  const right = b.replace(/^0+(?=\d)/, "");
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}

/**
 * The migrations among a directory's filenames, in run order: the numeric
 * prefix, compared as a number, is the order they are meant to run in, and a
 * directory listing carries no order of its own. Throws when two files share
 * an id, such as `0001-x.ts` and `0001-x.js`.
 */
export function selectMigrationFiles(directory: string, filenames: string[]): MigrationFile[] {
  const selected = filenames
    .flatMap((filename) => {
      const match = MIGRATION_FILE.exec(filename);
      return match ? [{ id: match[1], prefix: match[2], filename }] : [];
    })
    .sort(
      (a, b) =>
        compareNumeric(a.prefix, b.prefix) ||
        (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0),
    );
  selected.forEach((entry, at) => {
    const twin = selected.find((other, otherAt) => otherAt !== at && other.id === entry.id);
    if (twin) {
      throw new MigrationError(
        `Migration files ${entry.filename} and ${twin.filename} share the id "${entry.id}". Keep one of them.`,
      );
    }
  });
  return selected.map(({ id, filename }) => ({ id, file: joinPath(directory, filename) }));
}

const MIN_PREFIX_WIDTH = 4;
const MAX_SLUG_LENGTH = 60;

/** Reduces free text to a slug the migration filename pattern accepts. */
function toMigrationSlug(name: string): string {
  const slug = name
    // Splits accented letters into base letter and mark, so `é` keeps its `e`.
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
  return slug || "migration";
}

/**
 * The id for a new migration: one past the highest numeric prefix among the
 * existing ids, zero-padded to the width they use (at least four digits), with
 * `name` reduced to a slug the loader accepts.
 */
export function nextMigrationId(existingIds: readonly string[], name: string): string {
  let highest = 0;
  let width = MIN_PREFIX_WIDTH;
  for (const id of existingIds) {
    const prefix = /^(\d+)-/.exec(id)?.[1];
    if (prefix === undefined) continue;
    highest = Math.max(highest, Number(prefix));
    width = Math.max(width, prefix.length);
  }
  return `${String(highest + 1).padStart(width, "0")}-${toMigrationSlug(name)}`;
}

export async function discoverMigrations(directory: string): Promise<MigrationFile[]> {
  const { readdir } = await import("node:fs/promises");
  const filenames = await readdir(directory).catch((): string[] => []);
  return selectMigrationFiles(directory, filenames);
}

export type LoadMigrationsOptions = {
  /**
   * Load only the migration with this id. The other files are not imported, so
   * a broken migration elsewhere in the directory does not block this one.
   */
  only?: string;
};

export async function loadMigrations(
  directory: string,
  importDefault: ImportDefault,
  options: LoadMigrationsOptions = {},
): Promise<LoadedMigration[]> {
  const files = (await discoverMigrations(directory)).filter(
    ({ id }) => options.only === undefined || id === options.only,
  );
  return Promise.all(
    files.map(async ({ id, file }) => {
      const migration = await importDefault(file).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        throw new MigrationError(`${file} could not be loaded: ${reason}`, { cause: error });
      });
      if (!isCompiledMigration(migration)) {
        throw new MigrationError(
          `${file} does not default-export a migration. Export \`defineMigration([…])\` as the default.`,
        );
      }
      return { id, file, migration };
    }),
  );
}
