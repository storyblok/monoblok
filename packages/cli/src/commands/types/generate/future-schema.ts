import { join } from 'pathe';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, toError } from '../../../utils';
import { resolvePath } from '../../../utils/filesystem';
import type { CLISpinner } from '../../../lib/ui';
import { getUI } from '../../../lib/ui';
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
}

/**
 * Runs `types generate --future-schema`: fetches the space's components and
 * writes schema-derived types.
 *
 * Owns the user-facing output for this mode so the command action stays a thin
 * branch. Errors are handled here rather than rethrown, matching the legacy
 * path's behaviour.
 */
export async function runFutureSchemaTypes({ options, globals }: FutureSchemaCommandOptions): Promise<void> {
  const { space, path, filename, separateFiles, verbose } = globals;
  const ui = getUI();
  ui.title(`${commands.TYPES}`, colorPalette.TYPES, 'Generating types from schema...');

  let spinner: CLISpinner | undefined;
  try {
    assertNoLegacyFlags(options);
    if (!space) {
      throw new CommandError('Please provide the space as argument --space SPACE_ID.');
    }

    spinner = ui.createSpinner('Generating types...');
    const result = await generateSchemaTypes({
      space,
      cwd: process.cwd(),
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
        + 'and point --field-plugins at the module (or place it at .storyblok/schema/schema.ts).',
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
