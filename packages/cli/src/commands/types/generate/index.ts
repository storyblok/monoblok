import { colorPalette, commands } from '../../../constants';
import { handleError, isVitest, konsola } from '../../../utils';
import { getProgram } from '../../../program';
import { Spinner } from '@topcli/spinner';
import { type ComponentsData, readComponentsFiles } from '../../components/push/actions';
import type { GenerateTypesOptions } from './constants';
import type { ReadComponentsOptions } from '../../components/push/constants';
import { typesCommand } from '../command';
import { generateStoryblokTypes, generateTypes, saveTypesToFile } from './actions';

const program = getProgram();

typesCommand
  .command('generate')
  .description('Generate types d.ts for your component schemas')
  .option('--sf, --separate-files', '')
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
      const spaceData = await readComponentsFiles({
        ...options as ReadComponentsOptions,
        from: space,
        path,
      });

      await generateStoryblokTypes({
        ...options,
        path,
      });

      // Add empty datasources array to match expected type for generateTypes
      const spaceDataWithDatasources: ComponentsData & { datasources: [] } = {
        ...spaceData,
        datasources: [],
      };

      const typedefString = await generateTypes(spaceDataWithDatasources, {
        ...options,
        path,
      });

      if (typedefString) {
        await saveTypesToFile(space, typedefString, {
          ...options,
          path,
        });
      }

      spinner.succeed();
      konsola.ok(`Successfully generated types for space ${space}`, true);
      konsola.br();
    }
    catch (error) {
      spinner.failed(`Failed to generate types for space ${space}`);
      konsola.br();
      handleError(error as Error, verbose);
    }
  });
