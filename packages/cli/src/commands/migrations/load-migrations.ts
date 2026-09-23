/**
 * Discovers content migration files in a space's migrations directory.
 *
 * Identity is the filename, not anything inside the file: that is what makes
 * "has this already run here?" answerable across machines. The name pattern
 * admits no dots, so the `*.before.ts` schema snapshots that sit beside
 * migrations, and anything else in the directory, are left alone.
 */
import { readdir } from "node:fs/promises";
import { join } from "pathe";
import type { CompiledMigration } from "@storyblok/schema/migrations";
import { isRecord } from "../../utils";

export type LoadedMigration = {
  /** Filename without its extension; the migration's identity. */
  id: string;
  file: string;
  migration: CompiledMigration;
};

const MIGRATION_FILE = /^(\d+-[a-z0-9-]+)\.(?:ts|js|mjs)$/;

function isCompiledMigration(value: unknown): value is CompiledMigration {
  return isRecord(value) && Array.isArray(value.ops) && Array.isArray(value.targets);
}

export async function loadMigrations(directory: string): Promise<LoadedMigration[]> {
  const files = await readdir(directory).catch((): string[] => []);

  // Sorted by filename, because the numeric prefix is the order the migrations
  // are meant to run in and a directory listing carries no order of its own.
  const candidates = files
    .flatMap((file) => {
      const match = MIGRATION_FILE.exec(file);
      return match ? [{ file, id: match[1] }] : [];
    })
    .sort((a, b) => a.file.localeCompare(b.file));

  if (candidates.length === 0) {
    return [];
  }

  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // Reading the tsconfig throws when it extends something unresolvable, which
    // would block migrations in a project that does not even use aliases.
    tsconfigPaths: process.env.JITI_TSCONFIG_PATHS !== "false",
  });

  return Promise.all(
    candidates.map(async ({ file, id }) => {
      const full = join(directory, file);
      const migration: unknown = await jiti.import(full, { default: true });
      if (!isCompiledMigration(migration)) {
        throw new Error(
          `${file} does not default-export a migration. Export \`defineMigration([…])\` as the default.`,
        );
      }
      return { id, file: full, migration };
    }),
  );
}
