export interface SchemaAffectedOptions {
  space?: string;
  path?: string;
  /** Comma-separated component names to restrict the analysis to. */
  component?: string;
  /** Directory of locally pulled story JSON files to analyze instead of fetching remote. */
  stories?: string;
  /** Treat remote-only (stale) components as removed, mirroring `schema push --delete`. */
  delete?: boolean;
  /** Print the full list of affected stories, not just the summary. */
  list?: boolean;
  /** Write the detailed impact report to this JSON file. */
  output?: string;
}
