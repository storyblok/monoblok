import type { CommandOptions } from '../../../types';

/**
 * Interface representing the options for the `components pull` command.
 */
export interface PullComponentsOptions extends CommandOptions {

  /**
   * The filename to save the file as.
   * Defaults to `components`. The file will be saved as `<filename>.<space>.json`.
   * @default `components
   */
  filename?: string;
  /**
   * The suffix to add to the filename.
   * Defaults to the space ID.
   * @default space
   */
  suffix?: string;
  /**
   * Indicates whether to save each component to a separate file.
   * @default false
   */
  separateFiles?: boolean;
  /**
   * Glob pattern to select components by name. Matching components and their dependencies
   * (assigned groups with ancestors, tags, presets, and schema-whitelisted groups/tags) are pulled.
   */
  filter?: string;
}

export interface SaveComponentsOptions extends PullComponentsOptions {
  /**
   * The path to save the components file to.
   * Defaults to `.storyblok/components`.
   * @default `.storyblok/components`
   */
  path?: string;
  /**
   * Glob pattern to select components by name before pushing.
   * @default `.*`
   */
  filter?: string;
  /**
   * Indicates whether to read each component to a separate file.
   * @default false
   */
  separateFiles?: boolean;

}
