import type { Command } from 'commander';
import { join } from 'pathe';
import { colorPalette, commands } from '../../../constants';
import { CommandError, FileSystemError, handleError, konsola, toError } from '../../../utils';
import { resolvePath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { Spinner } from '@topcli/spinner';
import { type ComponentsData, readComponentsFiles } from '../../components/push/actions';
import type { GenerateTypesOptions } from './constants';
import { typesCommand } from '../command';
import { generateStoryblokTypes, generateTypes, saveTypesToComponentsFile } from './actions';
import { readDatasourcesFiles } from '../../datasources/push/actions';
import type { SpaceDatasourcesData } from '../../../commands/datasources/constants';
import { assertNoLegacyFlags, generateSchemaTypes } from './schema-types';

const generateCmd = typesCommand
  .command('generate')
  .description('Generate types d.ts for your component schemas')
  .option(
    '--filename <name>',
    'Base file name for all component types when generating a single declarations file (e.g. components.d.ts). Ignored when using --separate-files.',
  )
  .option('--sf, --separate-files', 'Generate one .d.ts file per component instead of a single combined file')
  .option('--strict', 'strict mode, no loose typing')
  .option('--type-prefix <prefix>', 'prefix to be prepended to all generated component type names')
  .option('--type-suffix <suffix>', 'suffix to be appended to all generated component type names')
  .option('--suffix <suffix>', 'Components suffix')
  .option('--custom-fields-parser <path>', 'Path to the parser file for Custom Field Types')
  .option('--compiler-options <options>', 'path to the compiler options from json-schema-to-typescript')
  .option('-s, --space <space>', 'space ID')
  .option('--future-schema', 'Generate types from the space schema (accurate optionality, block narrowing, and custom field types)')
  .option('--field-plugins <path>', 'Path to a module exporting your defineFieldPlugin declarations (default: .storyblok/schema/schema.ts)');

generateCmd
  .action(async (options: GenerateTypesOptions, command: Command) => {
    const { space, path, verbose, suffix, filename, separateFiles } = command.optsWithGlobals();

    if (options.futureSchema) {
      const ui = getUI();
      ui.title(`${commands.TYPES}`, colorPalette.TYPES, 'Generating types from schema...');
      let spinner: ReturnType<typeof ui.createSpinner> | undefined;
      try {
        assertNoLegacyFlags(options);
        if (!space) {
          throw new CommandError('Please provide the space as argument --space SPACE_ID.');
        }

        spinner = ui.createSpinner('Generating types...');
        const outputDir = resolvePath(path, join('types', space));
        const result = await generateSchemaTypes({
          space,
          cwd: process.cwd(),
          outputDir,
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
      return;
    }

    konsola.title(`${commands.TYPES}`, colorPalette.TYPES, 'Generating types...');
    konsola.warn(
      '`types generate` without --future-schema is deprecated. The legacy generator does not follow '
      + 'field `required` flags, block whitelists, or nestable/root distinctions. Re-run with --future-schema.',
    );
    if (options.fieldPlugins !== undefined) {
      konsola.warn('--field-plugins is ignored without --future-schema.');
    }

    const spinner = new Spinner({
      verbose,
    });

    try {
      spinner.start(`Generating types...`);
      // Input format is auto-detected based on files on disk
      const componentsData = await readComponentsFiles({
        from: space,
        path,
        suffix,
        verbose,
      });
      // Try to read datasources, but make it optional
      let dataSourceData: SpaceDatasourcesData;
      try {
        dataSourceData = await readDatasourcesFiles({
          from: space,
          path,
          suffix,
          verbose,
        });
      }
      catch (error) {
        // Only catch the specific case where datasources don't exist
        if (error instanceof FileSystemError && error.errorId === 'file_not_found') {
          dataSourceData = { datasources: [] };
        }
        else {
          throw error;
        }
      }
      await generateStoryblokTypes({
        path,
      });

      // Add empty datasources array to match expected type for generateTypes
      const spaceDataWithComponentsAndDatasources: ComponentsData & SpaceDatasourcesData = {
        ...componentsData,
        ...dataSourceData,
      };

      const typedefData = await generateTypes(spaceDataWithComponentsAndDatasources, {
        ...options,
      });

      if (typedefData) {
        await saveTypesToComponentsFile(space, typedefData, {
          filename,
          path,
          separateFiles,
        });
      }

      spinner.succeed();
      if (separateFiles && filename) {
        konsola.warn(`The --filename option is ignored when using --separate-files`);
      }

      konsola.ok(`Successfully generated types for space ${space}`, true);
      konsola.br();
    }
    catch (error) {
      spinner.failed(`Failed to generate types for space ${space}`);
      konsola.br();
      handleError(error as Error, verbose);
    }
  });
