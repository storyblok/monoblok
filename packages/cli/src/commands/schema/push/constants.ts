export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  migrations: boolean;
  before: boolean;
  typed?: boolean;
  writeComponents: boolean;
}
