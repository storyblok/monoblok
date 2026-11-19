export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  force: boolean;
  migrations: boolean;
  before: boolean;
  typed?: boolean;
  writeComponents: boolean;
}
