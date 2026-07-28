import type { Command } from 'commander';
import { colorPalette, commands } from '../../../constants';
import { FileSystemError, handleError, konsola } from '../../../utils';
import { Spinner } from '@topcli/spinner';
import { type ComponentsData, readComponentsFiles } from '../../components/push/actions';
import type { GenerateTypesOptions } from './constants';
import { typesCommand } from '../command';
import { generateStoryblokTypes, generateTypes, saveTypesToComponentsFile } from './actions';
import { readDatasourcesFiles } from '../../datasources/push/actions';
import type { SpaceDatasourcesData } from '../../../commands/datasources/constants';
import { runFutureSchemaTypes } from './future-schema';

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
  .option('--future-schema', 'Generate types from the space schema')
  .option('--field-plugins <path>', 'Path to a module exporting your defineFieldPlugin declarations (default: .storyblok/schema/schema.ts)');

generateCmd
  .action(async (options: GenerateTypesOptions, command: Command) => {
    const { space, path, verbose, suffix, filename, separateFiles } = command.optsWithGlobals();

    if (options.futureSchema) {
      await runFutureSchemaTypes({
        options,
        globals: { space, path, filename, separateFiles, verbose },
      });
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
