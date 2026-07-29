import { join } from 'pathe';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, toError } from '../../../utils';
import { resolvePath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { DEFAULT_SCHEMA_ENTRY_PATH } from '../../schema/constants';
import type { GenerateTypesOptions } from './constants';
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
    if (filename !== undefined) {
      ui.warn(
        `--filename is set to \`${filename}\`, which is also where the legacy generator writes. `
        + 'Regenerating with and without --future-schema will overwrite one with the other. '
        + 'Leave it unset to keep them in separate files.',
      );
    }

    spinner = ui.createSpinner('Generating types...');
    const result = await generateSchemaTypes({
      space,
      cwd: process.cwd(),
      path,
      outputDir: resolvePath(path, join('types', space)),
      filename: filename ?? 'storyblok-schema',
      separateFiles,
      typePrefix: options.typePrefix,
      typeSuffix: options.typeSuffix,
      fieldPluginsPath: options.fieldPlugins,
    });
    spinner.succeed('Generated types');

    result.files.forEach(file => ui.ok(file));
    if (result.unmappedFieldTypes.length > 0) {
      ui.warn(
        `No field plugin registered for: ${result.unmappedFieldTypes.join(', ')}. `
        + 'These custom fields fall back to an untyped value. Declare them with defineFieldPlugin '
        + `and point --field-plugins at the module (or place it at ${DEFAULT_SCHEMA_ENTRY_PATH}).`,
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
