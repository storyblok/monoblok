import { Spinner } from '@topcli/spinner';
import { colorPalette, commands } from '../../../constants';
import { session } from '../../../session';

import { getProgram } from '../../../program';
import { mapiClient } from '../../../api';
import { datasourcesCommand } from '../command';
import type { PullDatasourcesOptions } from './constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import chalk from 'chalk';
import { fetchDatasource, fetchDatasources, saveDatasourcesToFiles } from './actions';
import { join } from 'pathe';
import { DEFAULT_STORAGE_DIR } from '../../../utils/filesystem';

const program = getProgram();

datasourcesCommand
  .command('pull [datasourceName]')
  .option('-f, --filename <filename>', 'custom name to be used in file(s) name instead of space id', 'datasources')
  .option('--sf, --separate-files', 'Argument to create a single file for each datasource', false)
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. datasources.<suffix>.json)')
  .description('Pull datasources from your space')
  .action(async (datasourceName: string | undefined, options: PullDatasourcesOptions) => {
    konsola.title(`${commands.DATASOURCES}`, colorPalette.DATASOURCES, datasourceName ? `Pulling datasource ${datasourceName}...` : 'Pulling datasources...');

    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space, path } = datasourcesCommand.opts();
    const {
      separateFiles = false,
      suffix,
      filename = 'datasources',
    } = options;
    // Keep writing under .storyblok unless a command-level --path explicitly overrides it.
    const resolvedBaseDir = path ?? DEFAULT_STORAGE_DIR;
    const datasourcesOutputDir = join(resolvedBaseDir, 'datasources', space);

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const { password, region } = state;

    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

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
        if (filename !== 'datasources') {
          konsola.warn(`The --filename option is ignored when using --separate-files`);
        }
        const filePath = `${datasourcesOutputDir}/`;
        konsola.ok(`Datasources downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(filePath)}`);
      }
      else if (datasourceName) {
        const fileName = suffix ? `${filename}.${suffix}.json` : `${datasourceName}.json`;
        const filePath = join(datasourcesOutputDir, fileName);
        konsola.ok(`Datasource ${chalk.hex(colorPalette.PRIMARY)(datasourceName)} downloaded successfully in ${chalk.hex(colorPalette.PRIMARY)(filePath)}`);
      }
      else {
        const fileName = suffix ? `${filename}.${suffix}.json` : `${filename}.json`;
        const filePath = join(datasourcesOutputDir, fileName);
        konsola.ok(`Datasources downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(filePath)}`);
      }
      konsola.br();
    }
    catch (error) {
      spinnerDatasources.failed(`Fetching ${chalk.hex(colorPalette.DATASOURCES)('Datasources')} - Failed`);
      konsola.br();
      handleError(error as Error, verbose);
    }
  });
