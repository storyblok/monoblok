/** Base file name `--future-schema` writes when `--filename` is unset. */
export const DEFAULT_SCHEMA_TYPES_FILENAME = 'storyblok-schema';

/**
 * Base file name the legacy generator writes when `--filename` is unset.
 *
 * Shared with `--future-schema`, which warns when `--filename` aims it at this
 * name, so the two generators cannot overwrite each other unnoticed.
 */
export const DEFAULT_COMPONENT_TYPES_FILENAME = 'storyblok-components';

export interface GenerateTypesOptions {
  separateFiles?: boolean;
  strict?: boolean;
  typePrefix?: string;
  typeSuffix?: string;
  filename?: string;
  path?: string;
  suffix?: string;
  customFieldsParser?: string;
  compilerOptions?: string;
  /** Generate types from the space schema instead of the legacy JSON-schema generator. */
  futureSchema?: boolean;
  /** Path to a module exporting `defineFieldPlugin` declarations. */
  fieldPlugins?: string;
}
