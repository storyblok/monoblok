export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  migrations: boolean;
  before: boolean;
  js?: boolean;
  writeComponents: boolean;
}
