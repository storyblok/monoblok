/**
 * Discovers content migration files in a space's migrations directory.
 *
 * Identity is the filename, not anything inside the file: that is what makes
 * "has this already run here?" answerable across machines. The name pattern
 * admits no dots, so the `*.before.ts` schema snapshots that sit beside
 * migrations, and anything else in the directory, are left alone.
 */
import type { CompiledMigration } from "./define-migration";
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

const MIGRATION_FILE = /^(\d+-[a-z0-9-]+)\.(?:ts|js|mjs)$/;

function isCompiledMigration(value: unknown): value is CompiledMigration {
  return isRecord(value) && Array.isArray(value.ops) && Array.isArray(value.targets);
}

/**
 * The migrations among a directory's filenames, in run order: the numeric
 * prefix is the order they are meant to run in, and a directory listing
 * carries no order of its own.
 */
export function selectMigrationFiles(directory: string, filenames: string[]): MigrationFile[] {
  return filenames
    .flatMap((filename) => {
      const match = MIGRATION_FILE.exec(filename);
      return match ? [{ id: match[1], filename }] : [];
    })
    .sort((a, b) => a.filename.localeCompare(b.filename))
    .map(({ id, filename }) => ({ id, file: joinPath(directory, filename) }));
}

export async function discoverMigrations(directory: string): Promise<MigrationFile[]> {
  const { readdir } = await import("node:fs/promises");
  const filenames = await readdir(directory).catch((): string[] => []);
  return selectMigrationFiles(directory, filenames);
}

export async function loadMigrations(
  directory: string,
  importDefault: ImportDefault,
): Promise<LoadedMigration[]> {
  const files = await discoverMigrations(directory);
  return Promise.all(
    files.map(async ({ id, file }) => {
      const migration = await importDefault(file);
      if (!isCompiledMigration(migration)) {
        throw new Error(
          `${file} does not default-export a migration. Export \`defineMigration([…])\` as the default.`,
        );
      }
      return { id, file, migration };
    }),
  );
}
