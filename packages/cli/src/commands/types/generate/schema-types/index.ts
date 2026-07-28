import { join } from 'pathe';

import { CommandError, saveToFile } from '../../../../utils';
import { buildGroupDisplayPathByUuid } from '../../../schema/folders';
import { fetchRemoteSchema } from '../../../schema/actions';
import type { GenerateTypesOptions } from '../constants';
import { resolveFieldPluginsSource } from './field-plugins';
import { renderSchemaTypes, renderSeparateFiles, toRelativeImport } from './render';
import { serializeBlockDefinition } from './serialize';

/** Options that only the legacy `json-schema-to-typescript` generator supports. */
const LEGACY_ONLY_FLAGS: ReadonlyArray<readonly [keyof GenerateTypesOptions, string]> = [
  ['strict', '--strict'],
  ['customFieldsParser', '--custom-fields-parser'],
  ['compilerOptions', '--compiler-options'],
];

/**
 * Rejects flags that cannot mean anything under `--future-schema`: optionality
 * now comes from each field's `required`, custom fields resolve through
 * `defineFieldPlugin`, and there is no `json-schema-to-typescript` to configure.
 * Failing loudly beats silently ignoring a flag the user believes is applied.
 */
export function assertNoLegacyFlags(options: GenerateTypesOptions): void {
  const used = LEGACY_ONLY_FLAGS
    .filter(([key]) => options[key] !== undefined)
    .map(([, flag]) => flag);

  if (used.length > 0) {
    throw new CommandError(
      `${used.join(', ')} ${used.length === 1 ? 'is' : 'are'} not supported with --future-schema. `
      + 'Field optionality comes from the schema, custom fields are typed with defineFieldPlugin '
      + '(see --field-plugins), and no JSON-schema compiler is involved.',
    );
  }
}

export interface GenerateSchemaTypesOptions {
  space: string;
  /** Project root, used to resolve the field-plugins module. */
  cwd: string;
  /** Absolute directory the files are written into. */
  outputDir: string;
  /** Base file name without extension. */
  filename: string;
  separateFiles?: boolean;
  typePrefix?: string;
  typeSuffix?: string;
  fieldPluginsPath?: string;
}

export interface GenerateSchemaTypesResult {
  /** Absolute paths written, in write order. */
  files: string[];
  /** `custom` field types with no registered plugin, typed loosely, warned about. */
  unmappedFieldTypes: string[];
}

/**
 * Fetches a space's components and writes schema-derived types.
 *
 * The emitted file declares block *definition* types and derives content types
 * from them through `@storyblok/schema`, so every field to value rule stays in
 * the library. Datasources are not emitted: `option`/`options` fields resolve
 * to `string`/`string[]` regardless, so they cannot affect the types.
 */
export async function generateSchemaTypes(
  options: GenerateSchemaTypesOptions,
): Promise<GenerateSchemaTypesResult> {
  const { rawComponents, rawComponentFolders } = await fetchRemoteSchema(options.space);

  if (rawComponents.length === 0) {
    throw new CommandError(`Space ${options.space} has no components, so there are no types to generate.`);
  }

  const displayPathByUuid = buildGroupDisplayPathByUuid(rawComponentFolders);
  const blocks = rawComponents.map(component => serializeBlockDefinition(component, { displayPathByUuid }));

  const fieldPlugins = await resolveFieldPluginsSource({ cwd: options.cwd, override: options.fieldPluginsPath });
  const fieldPluginsImportPath = fieldPlugins.kind === 'none'
    ? undefined
    : toRelativeImport(options.outputDir, fieldPlugins.modulePath);

  const renderOptions = {
    blocks,
    fieldPlugins,
    fieldPluginsImportPath,
    space: options.space,
    typePrefix: options.typePrefix,
    typeSuffix: options.typeSuffix,
  };

  const outputs = options.separateFiles
    ? renderSeparateFiles({ ...renderOptions, filename: options.filename })
    : new Map([[`${options.filename}.d.ts`, renderSchemaTypes(renderOptions)]]);

  const files: string[] = [];
  for (const [relativePath, content] of outputs) {
    const absolutePath = join(options.outputDir, relativePath);
    await saveToFile(absolutePath, content);
    files.push(absolutePath);
  }

  const registered = new Set(fieldPlugins.kind === 'none' ? [] : fieldPlugins.fieldTypes);
  const unmappedFieldTypes = [...new Set(blocks.flatMap(block => block.customFieldTypes))]
    .filter(fieldType => !registered.has(fieldType));

  return { files, unmappedFieldTypes };
}
