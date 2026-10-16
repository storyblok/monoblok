export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  migrations: boolean;
  before: boolean;
  legacy?: boolean;
  writeComponents: boolean;
}
