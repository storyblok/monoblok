import type { Command } from 'commander';
import { Spinner } from '@topcli/spinner';
import { colorPalette, commands, directories } from '../../../constants';
import { session } from '../../../session';

import { datasourcesCommand } from '../command';
import type { PullDatasourcesOptions } from './constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import chalk from 'chalk';
import { fetchDatasource, fetchDatasources, saveDatasourcesToFiles } from './actions';
import { isAbsolute, join, relative } from 'pathe';
import { resolveCommandPath } from '../../../utils/filesystem';
import { DEFAULT_DATASOURCES_FILENAME } from '../constants';

const pullCmd = datasourcesCommand
  .command('pull [datasourceName]')
  .option('-f, --filename <filename>', 'custom name to be used in file(s) name instead of space id')
  .option('--sf, --separate-files', 'Argument to create a single file for each datasource')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. datasources.<suffix>.json)')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage')
  .description('Pull datasources from your space');

pullCmd
  .action(async (datasourceName: string | undefined, options: PullDatasourcesOptions, command: Command) => {
    konsola.title(`${commands.DATASOURCES}`, colorPalette.DATASOURCES, datasourceName ? `Pulling datasource ${datasourceName}...` : 'Pulling datasources...');

    const { space, path, verbose } = command.optsWithGlobals();
    const {
      separateFiles = false,
      suffix,
      filename,
    } = options;

    // Use default filename when not provided
    const actualFilename = filename ?? DEFAULT_DATASOURCES_FILENAME;
    // Keep writing under .storyblok unless a command-level --path explicitly overrides it.
    const datasourcesOutputDir = resolveCommandPath(directories.datasources, space, path);

    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const spinnerDatasources = new Spinner({
      verbose: !isVitest,
    });

    try {
      spinnerDatasources.start(`Fetching ${chalk.hex(colorPalette.DATASOURCES)('datasources')}`);

      let datasources;
      if (datasourceName) {
        const datasource = await fetchDatasource(space, datasourceName);
        if (!datasource) {
          konsola.warn(`No datasource found with name "${datasourceName}"`);
          return;
        }
        datasources = [datasource];
      }
      else {
        datasources = await fetchDatasources(space);
        if (!datasources || datasources.length === 0) {
          konsola.warn(`No datasources found in the space ${space}`);
          return;
        }
      }

      spinnerDatasources.succeed(`${chalk.hex(colorPalette.DATASOURCES)('Datasources')} - Completed in ${spinnerDatasources.elapsedTime.toFixed(2)}ms`);

      await saveDatasourcesToFiles(
        space,
        datasources,
        { ...options, path, separateFiles: separateFiles || !!datasourceName },
      );
      konsola.br();
      if (separateFiles) {
        if (filename && filename !== DEFAULT_DATASOURCES_FILENAME) {
          konsola.warn(`The --filename option is ignored when using --separate-files`);
        }
        const filePath = `${datasourcesOutputDir}/`;
        // Only show relative path if the base path wasn't absolute
        const displayPath = (path && isAbsolute(path)) ? filePath : `${relative(process.cwd(), datasourcesOutputDir)}/`;
        konsola.ok(`Datasources downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`);
      }
      else if (datasourceName) {
        const fileName = suffix ? `${actualFilename}.${suffix}.json` : `${datasourceName}.json`;
        const filePath = join(datasourcesOutputDir, fileName);
        // Only show relative path if the base path wasn't absolute
        const displayPath = (path && isAbsolute(path)) ? filePath : relative(process.cwd(), filePath);
        konsola.ok(`Datasource ${chalk.hex(colorPalette.PRIMARY)(datasourceName)} downloaded successfully in ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`);
      }
      else {
        const fileName = suffix ? `${actualFilename}.${suffix}.json` : `${actualFilename}.json`;
        const filePath = join(datasourcesOutputDir, fileName);
        // Only show relative path if the base path wasn't absolute
        const displayPath = (path && isAbsolute(path)) ? filePath : relative(process.cwd(), filePath);
        konsola.ok(`Datasources downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`);
      }
      konsola.br();
    }
    catch (error) {
      spinnerDatasources.failed(`Fetching ${chalk.hex(colorPalette.DATASOURCES)('Datasources')} - Failed`);
      konsola.br();
      handleError(error as Error, verbose);
    }
  });
