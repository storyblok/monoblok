export interface SchemaPushOptions {
  dryRun: boolean;
  delete: boolean;
  migrations: boolean;
  snapshots: boolean;
  legacy?: boolean;
  writeComponents: boolean;
}
