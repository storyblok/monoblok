export interface SchemaAffectedOptions {
  space?: string;
  path?: string;
  /** Analyze locally pulled story JSON files (default stories directory) instead of fetching remote. */
  local?: boolean;
  /** Treat remote-only components as deleted, mirroring `schema push --delete`. */
  includeDeleted?: boolean;
  /** Exit with a non-zero code when any story would break (for CI gating). */
  failOnBreak?: boolean;
}
