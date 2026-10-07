/**
 * Discovers content migration files in a space's migrations directory.
 *
 * Identity is the filename, not anything inside the file: that is what makes
 * "has this already run here?" answerable across machines. The name pattern
 * admits no dots, so the `*.before.ts` schema snapshots that sit beside
 * migrations, and anything else in the directory, are left alone.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CompiledMigration } from "../define-migration";
import { isRecord } from "../../utils/is-record";

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

/** Migration files in run order: the numeric prefix is the order they are meant to run in. */
export async function discoverMigrations(directory: string): Promise<MigrationFile[]> {
  const files = await readdir(directory).catch((): string[] => []);
  return files
    .flatMap((file) => {
      const match = MIGRATION_FILE.exec(file);
      return match ? [{ id: match[1], file: path.join(directory, file) }] : [];
    })
    .sort((a, b) => a.file.localeCompare(b.file));
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
          `${path.basename(file)} does not default-export a migration. Export \`defineMigration([…])\` as the default.`,
        );
      }
      return { id, file, migration };
    }),
  );
}
