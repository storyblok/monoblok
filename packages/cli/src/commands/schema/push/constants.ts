import type { MigrationFormat } from "../../migrations/content-migrations";

export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  force: boolean;
  yes: boolean;
  rename: string[];
  renameBlock: string[];
  renames: boolean;
  /** `undefined` asks whether to generate migrations for breaking changes. */
  migrations?: boolean;
  /** @todo(next-major): Remove with the `js` format. */
  migrationFormat: MigrationFormat;
  migrationSnapshot: boolean;
  writeComponents: boolean;
}
