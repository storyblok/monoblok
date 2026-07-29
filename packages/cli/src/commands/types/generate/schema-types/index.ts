import { join } from 'pathe';

import { CommandError } from '../../../../utils';
import { saveToFile } from '../../../../utils/filesystem';
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
  ['suffix', '--suffix'],
];

/**
 * Rejects flags that cannot mean anything under `--future-schema`: optionality
 * now comes from each field's `required`, custom fields resolve through
 * `defineFieldPlugin`, there is no `json-schema-to-typescript` to configure,
 * and `--suffix` only selects pulled component files, which this generator
 * never reads. Failing loudly beats silently ignoring a flag the user
 * believes is applied.
 *
 * A flag the *config file* set is a different case, and must not be an error: a
 * project that configures `strict` for the legacy generator would otherwise be
 * unable to use `--future-schema` at all without editing its config, having
 * typed nothing wrong. Those are returned instead, for the caller to report as
 * ignored. `getOptionValueSource` comes from Commander, which records `'config'`
 * for values hydrated by `applyConfigToCommander`; without it every set flag is
 * treated as user-supplied.
 *
 * @returns the legacy-only flags that came from config and are being ignored.
 */
export function assertNoLegacyFlags(
  options: GenerateTypesOptions,
  getOptionValueSource?: (attributeName: string) => string | undefined,
): string[] {
  const set = LEGACY_ONLY_FLAGS.filter(([key]) => options[key] !== undefined);
  const fromConfig = set.filter(([key]) => getOptionValueSource?.(key) === 'config');
  const used = set.filter(entry => !fromConfig.includes(entry)).map(([, flag]) => flag);

  if (used.length > 0) {
    throw new CommandError(
      `${used.join(', ')} ${used.length === 1 ? 'is' : 'are'} not supported with --future-schema. `
      + 'Field optionality comes from the schema, custom fields are typed with defineFieldPlugin '
      + '(see --field-plugins), and no JSON-schema compiler is involved.',
    );
  }

  return fromConfig.map(([, flag]) => flag);
}

export interface GenerateSchemaTypesOptions {
  space: string;
  /** Project root, used to resolve the field-plugins module. */
  cwd: string;
  /** The CLI base path (`--path`), which the field-plugins convention path honours. */
  path?: string;
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
  const knownBlockNames = new Set(rawComponents.map(component => component.name));
  // Sorted by name so regeneration is byte-stable: MAPI does not promise a
  // stable component order, and this file is committed, so an upstream
  // reordering would otherwise show up as a diff with no semantic change.
  // Compared by code unit rather than `localeCompare`, which would order
  // differently depending on the machine's locale.
  const blocks = [...rawComponents]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(component => serializeBlockDefinition(component, { displayPathByUuid, knownBlockNames }));

  const fieldPlugins = await resolveFieldPluginsSource({
    cwd: options.cwd,
    path: options.path,
    override: options.fieldPluginsPath,
  });
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
