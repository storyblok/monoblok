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
  before: boolean;
  typed?: boolean;
  writeComponents: boolean;
}
