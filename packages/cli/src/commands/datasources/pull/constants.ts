import type { CommandOptions } from '../../../types';

/**
 * Interface representing the options for the `datasources pull` command.
 */
export interface PullDatasourcesOptions extends CommandOptions {

  /**
   * The filename to save the file as.
   * Defaults to `DEFAULT_DATASOURCES_FILENAME`. The file will be saved as `<filename>.<space>.json`.
   * @default DEFAULT_DATASOURCES_FILENAME
   */
  filename?: string;
  /**
   * The suffix to add to the filename.
   * Defaults to the space ID.
   * @default space
   */
  suffix?: string;
  /**
   * Indicates whether to save each datasource to a separate file.
   * @default false
   */
  separateFiles?: boolean;
}

export interface SaveDatasourcesOptions extends PullDatasourcesOptions {
  /**
   * The path to save the datasources file to.
   * Defaults to `.storyblok/datasources`.
   * @default `.storyblok/datasources`
   */
  path?: string;
  /**
   * The regex filter to apply to the datasources before pushing.
   * @default `.*`
   */
  filter?: string;
  /**
   * Indicates whether to read each datasource to a separate file.
   * @default false
   */
  separateFiles?: boolean;

}
