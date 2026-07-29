import { join, relative } from 'pathe';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, toError } from '../../../utils';
import { resolvePath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { DEFAULT_COMPONENT_TYPES_FILENAME, DEFAULT_SCHEMA_TYPES_FILENAME, type GenerateTypesOptions } from './constants';
import { toDeclarationFileName } from './filename';
import { assertNoLegacyFlags, generateSchemaTypes } from './schema-types';

export interface FutureSchemaCommandOptions {
  /** Command options, including the legacy-only flags this mode rejects. */
  options: GenerateTypesOptions;
  /** Global options resolved from Commander and the config file. */
  globals: {
    space?: string;
    path?: string;
    filename?: string;
    separateFiles?: boolean;
    verbose?: boolean;
  };
  /**
   * Commander's per-option source lookup, used to tell a flag the user typed
   * from one their config file set. See {@link assertNoLegacyFlags}.
   */
  getOptionValueSource?: (attributeName: string) => string | undefined;
}

/**
 * Runs `types generate --future-schema`: fetches the space's components and
 * writes schema-derived types.
 *
 * Owns the user-facing output for this mode so the command action stays a thin
 * branch. Errors are handled here rather than rethrown, matching the legacy
 * path's behaviour.
 */
export async function runFutureSchemaTypes(
  { options, globals, getOptionValueSource }: FutureSchemaCommandOptions,
): Promise<void> {
  const { space, path, filename, separateFiles, verbose } = globals;
  const ui = getUI();
  ui.title(`${commands.TYPES}`, colorPalette.TYPES, 'Generating types from schema...');

  let spinner: ReturnType<typeof ui.createSpinner> | undefined;
  try {
    const ignoredFromConfig = assertNoLegacyFlags(options, getOptionValueSource);
    if (ignoredFromConfig.length > 0) {
      ui.warn(
        `Ignoring ${ignoredFromConfig.join(', ')} from your config file: `
        + 'not supported with --future-schema.',
      );
    }
    if (!space) {
      throw new CommandError('Please provide the space as argument --space SPACE_ID.');
    }
    // Only the legacy generator's own file name is a collision. Warning on every
    // --filename told users their own path clashed with a file nothing writes.
    if (filename !== undefined
      && toDeclarationFileName(filename) === toDeclarationFileName(DEFAULT_COMPONENT_TYPES_FILENAME)) {
      ui.warn(
        `--filename is set to \`${toDeclarationFileName(filename)}\`, which is also where the legacy `
        + 'generator writes. Regenerating with and without --future-schema will overwrite one with the '
        + `other. Leave it unset to write to ${toDeclarationFileName(DEFAULT_SCHEMA_TYPES_FILENAME)} instead.`,
      );
    }

    spinner = ui.createSpinner('Generating types...');
    const result = await generateSchemaTypes({
      space,
      cwd: process.cwd(),
      path,
      outputDir: resolvePath(path, join('types', space)),
      filename: filename ?? DEFAULT_SCHEMA_TYPES_FILENAME,
      separateFiles,
      typePrefix: options.typePrefix,
      typeSuffix: options.typeSuffix,
      fieldPluginsPath: options.fieldPlugins,
    });
    spinner.succeed('Generated types');

    result.files.forEach(file => ui.ok(file));
    if (result.prunedFiles.length > 0) {
      // Says so rather than deleting silently: these are files a previous run
      // wrote, so their disappearance would otherwise look like data loss.
      ui.info(
        `Removed ${result.prunedFiles.length} stale block type `
        + `${result.prunedFiles.length === 1 ? 'file' : 'files'} for components that no longer exist.`,
      );
    }
    if (result.unmappedFieldTypes.length > 0) {
      // Names the module actually in use, or the path this run searched. `--path`
      // moves the convention path, so the default would point at the wrong file.
      const where = relative(process.cwd(), result.fieldPlugins.path);
      const remedy = result.fieldPlugins.resolved
        ? `in ${where}.`
        : `and point --field-plugins at the module (or place it at ${where}).`;
      ui.warn(
        `No field plugin registered for: ${result.unmappedFieldTypes.join(', ')}. `
        + `These custom fields fall back to an untyped value. Declare them with defineFieldPlugin ${remedy}`,
      );
    }
    ui.info('The generated types import from `@storyblok/schema`. Install it as a dev dependency: `npm i -D @storyblok/schema`.');
    ui.br();
  }
  catch (error) {
    spinner?.failed(`Failed to generate types for space ${space}`);
    ui.br();
    handleError(toError(error), verbose);
  }
}
