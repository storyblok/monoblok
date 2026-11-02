export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  force: boolean;
  yes: boolean;
  rename: string[];
  renameBlock: string[];
  renames: boolean;
  migrations: boolean;
  before: boolean;
  typed?: boolean;
  writeComponents: boolean;
}
