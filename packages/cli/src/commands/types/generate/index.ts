import { colorPalette, commands } from '../../../constants';
import { FileSystemError, handleError, isVitest, konsola } from '../../../utils';
import { getProgram } from '../../../program';
import { Spinner } from '@topcli/spinner';
import { type ComponentsData, readComponentsFiles } from '../../components/push/actions';
import type { GenerateTypesOptions } from './constants';
import { typesCommand } from '../command';
import { generateStoryblokTypes, generateTypes, saveTypesToComponentsFile } from './actions';
import { readDatasourcesFiles } from '../../datasources/push/actions';
import type { SpaceDatasourcesData } from '../../../commands/datasources/constants';

const program = getProgram();

typesCommand
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
  .action(async (options: GenerateTypesOptions) => {
    konsola.title(`${commands.TYPES}`, colorPalette.TYPES, 'Generating types...');
    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space, path } = typesCommand.opts();

    const spinner = new Spinner({
      verbose: !isVitest,
    });

    try {
      spinner.start(`Generating types...`);
      const componentsData = await readComponentsFiles({
        from: space,
        path,
        suffix: options.suffix,
        verbose,
      });
      // Try to read datasources, but make it optional
      let dataSourceData: SpaceDatasourcesData;
      try {
        dataSourceData = await readDatasourcesFiles({
          from: space,
          path,
          suffix: options.suffix,
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
        path,
      });

      if (typedefData) {
        await saveTypesToComponentsFile(space, typedefData, {
          filename: options.filename,
          path,
          separateFiles: options.separateFiles,
        });
      }

      spinner.succeed();
      if (options.separateFiles && options.filename) {
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
