import { rm } from 'node:fs/promises';
import { join } from 'pathe';

import { CommandError } from '../../../../utils';
import { fileExists, readDirectory, saveToFile } from '../../../../utils/filesystem';
import { buildGroupDisplayPathByUuid } from '../../../schema/folders';
import { fetchRemoteSchema } from '../../../schema/actions';
import type { GenerateTypesOptions } from '../constants';
import { toDeclarationFileName } from '../filename';
import { resolveFieldPluginsSource } from './field-plugins';
import { renderSchemaTypes, renderSeparateFiles, toRelativeImport } from './render';
import { serializeBlockDefinition } from './serialize';

/**
 * Options that only the legacy `json-schema-to-typescript` generator supports,
 * each with why it cannot mean anything here.
 *
 * The reason is per flag rather than shared: a single combined rationale ended up
 * explaining field optionality to someone who passed `--suffix`, which is about
 * file selection and has nothing to do with it.
 */
const LEGACY_ONLY_FLAGS: ReadonlyArray<readonly [keyof GenerateTypesOptions, string, string]> = [
  ['strict', '--strict', 'field optionality comes from each field\'s `required` flag'],
  ['customFieldsParser', '--custom-fields-parser', 'custom fields are typed with defineFieldPlugin, see --field-plugins'],
  ['compilerOptions', '--compiler-options', 'there is no JSON-schema compiler to configure'],
  ['suffix', '--suffix', 'it selects pulled component files, which this generator never reads'],
];

/**
 * Rejects flags that cannot mean anything under `--future-schema`, quoting the
 * per-flag reason from {@link LEGACY_ONLY_FLAGS}. Failing loudly beats silently
 * ignoring a flag the user believes is applied.
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
  const used = set.filter(entry => !fromConfig.includes(entry));

  if (used.length === 1) {
    const [, flag, reason] = used[0]!;
    throw new CommandError(`${flag} is not supported with --future-schema: ${reason}.`);
  }

  if (used.length > 1) {
    throw new CommandError(
      `${used.map(([, flag]) => flag).join(', ')} are not supported with --future-schema. `
      + `${used.map(([, flag, reason]) => `${flag}: ${reason}`).join('. ')}.`,
    );
  }

  return fromConfig.map(([, flag]) => flag);
}

/** The subdirectory `--separate-files` owns, one declaration file per block. */
const BLOCKS_DIR = 'blocks';

/**
 * Deletes declaration files in `blocks/` that this run did not write.
 *
 * The directory is created only by `--future-schema --separate-files` and holds
 * one file per component, so its correct contents are exactly this run's output.
 * Without reconciling it, a component deleted in the UI leaves its type file
 * behind — still importable, describing a block that no longer exists — and
 * switching back to single-file output orphans the whole directory. Users are
 * told not to hand-edit generated types, so they would not think to clean it.
 *
 * Scoped deliberately: only `*.d.ts` directly inside `blocks/`, never nested
 * paths and never the output directory itself, which the legacy generator also
 * writes into and which may hold files this command knows nothing about.
 *
 * @returns absolute paths deleted.
 */
async function pruneStaleBlockFiles(outputDir: string, outputs: Map<string, string>): Promise<string[]> {
  const blocksDir = join(outputDir, BLOCKS_DIR);

  if (!await fileExists(blocksDir)) {
    return [];
  }

  const written = new Set([...outputs.keys()]);
  const entries = await readDirectory(blocksDir);
  const stale = entries.filter(entry => entry.endsWith('.d.ts') && !written.has(`${BLOCKS_DIR}/${entry}`));

  const deleted: string[] = [];
  for (const entry of stale) {
    const absolutePath = join(blocksDir, entry);
    await rm(absolutePath, { force: true });
    deleted.push(absolutePath);
  }

  return deleted;
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
  /** Absolute paths of stale `blocks/` declarations this run deleted. */
  prunedFiles: string[];
  /** `custom` field types with no registered plugin, typed loosely, warned about. */
  unmappedFieldTypes: string[];
  /**
   * The field-plugins module this run used, or the path it searched when none
   * resolved. Lets the unmapped-field-type warning name a real path instead of
   * the default, which `--path` moves.
   */
  fieldPlugins: { resolved: boolean; path: string };
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
    : new Map([[toDeclarationFileName(options.filename), renderSchemaTypes(renderOptions)]]);

  const files: string[] = [];
  for (const [relativePath, content] of outputs) {
    const absolutePath = join(options.outputDir, relativePath);
    await saveToFile(absolutePath, content);
    files.push(absolutePath);
  }

  const prunedFiles = await pruneStaleBlockFiles(options.outputDir, outputs);

  const registered = new Set(fieldPlugins.kind === 'none' ? [] : fieldPlugins.fieldTypes);
  const unmappedFieldTypes = [...new Set(blocks.flatMap(block => block.customFieldTypes))]
    .filter(fieldType => !registered.has(fieldType));

  return {
    files,
    prunedFiles,
    unmappedFieldTypes,
    fieldPlugins: fieldPlugins.kind === 'none'
      ? { resolved: false, path: fieldPlugins.searchedPath }
      : { resolved: true, path: fieldPlugins.modulePath },
  };
}
