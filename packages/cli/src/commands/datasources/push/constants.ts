import type { CommandOptions } from '../../../types';

export interface PushDatasourcesOptions extends CommandOptions {

  /**
   * The glob pattern filter to apply to datasources before pushing.
   * @default `.*`
   */
  filter?: string;
  /**
   * Indicates whether to save each component to a separate file.
   * @default false
   */
  separateFiles?: boolean;
  /**
   * The source space id.
   */
  from?: string;
  /**
   * Suffix to add to the component name.
   */
  suffix?: string;
}

export interface ReadDatasourcesOptions extends PushDatasourcesOptions {
  /**
   * The path to read the datasources file from.
   * Defaults to `.storyblok/datasources`.
   * @default `.storyblok/datasources`
   */
  path?: string;
  /**
   * Target space
   */
  space?: string;
}
