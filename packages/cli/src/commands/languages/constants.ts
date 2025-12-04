import type { CommandOptions } from '../../types';

export const DEFAULT_LANGUAGES_FILENAME = 'languages';

/**
 * Interface representing the options for the `pull-languages` command.
 */
export interface PullLanguagesOptions extends CommandOptions {
  /**
   * The path to save the languages file to.
   * Defaults to `.storyblok/languages`.
   * @default `.storyblok/languages`
   */
  path?: string;
  /**
   * The space ID.
   * @required true
   */
  space: string;
  /**
   * The filename to save the file as.
   * Defaults to `DEFAULT_LANGUAGES_FILENAME`. The file will be saved as `<filename>.<space>.json`.
   * @default DEFAULT_LANGUAGES_FILENAME
   */
  filename?: string;
  /**
   * The suffix to add to the filename.
   * Defaults to the space ID.
   * @default space
   */
  suffix?: string;
}
