import type { CommandOptions } from '../../../types';

export interface PushComponentsOptions extends CommandOptions {

  /**
   * The glob pattern filter to apply to components before pushing.
   * Matching components and all their dependencies (groups, tags, other components)
   * will be collected and pushed together.
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
  /**
   * Component group name(s) or `Parent/Child` path(s) to select from local files. Includes descendants.
   * Repeatable; multiple values match any of the given groups.
   */
  group?: string[];
  /**
   * Component tag name(s) to select from local files. Repeatable and comma-separated; multiple values match any.
   */
  tag?: string[];
}

export interface ReadComponentsOptions extends PushComponentsOptions {
  /**
   * The path to read the components file from.
   * Defaults to `.storyblok/components`.
   * @default `.storyblok/components`
   */
  path?: string;
  /**
   * Target space
   */
  space?: string;
}
