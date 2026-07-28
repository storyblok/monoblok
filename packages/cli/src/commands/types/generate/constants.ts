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
