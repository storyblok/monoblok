import type { MigrationFormat } from "../../migrations/content-migrations";

export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  force: boolean;
  migrations: boolean;
  /** @todo(next-major): Remove with the `js` format. */
  migrationFormat: MigrationFormat;
  migrationSnapshot: boolean;
  writeComponents: boolean;
}
