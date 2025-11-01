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
}

export interface ReadComponentsOptions extends PushComponentsOptions {
  /**
   * Local path where component JSON files are located.
   *
   * ⚠️ Important: When using types generation command,
   * if you provide a custom `--path`, it must be the same
   * `--path` that was used when running
   * `storyblok components pull`.
   *
   * Defaults to `.storyblok/components`.
   * @default `.storyblok/components`
   */
  path?: string;
  /**
   * Target space
   */
  space?: string;
  /**
   * Determines the flow:
   * - `push-components`: pushing local components to Storyblok
   * - `types-generate`: generating type definitions from local JSON files
   */
  purpose?: 'push-components' | 'types-generate';
}
