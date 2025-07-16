// Constants and types for the datasources delete command
// (Currently not needed, but file is here for architectural consistency and future options)

/**
 * Options for the datasources delete command.
 */
export interface DeleteDatasourceOptions {
  /**
   * The datasource id to delete by, if provided. If not set, the command will delete by name.
   */
  id?: string;
  /**
   * If true, skip confirmation prompt (for CI or automation)
   */
  force?: boolean;
}
