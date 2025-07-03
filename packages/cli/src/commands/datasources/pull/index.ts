import { Spinner } from '@topcli/spinner';
import { colorPalette, commands } from '../../../constants';
import { session } from '../../../session';

import { getProgram } from '../../../program';
import { mapiClient } from '../../../api';
import { datasourcesCommand } from '../command';
/* import type { PullDatasourcesOptions } from './constants'; */
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import chalk from 'chalk';
import { fetchDatasources } from './actions';

const program = getProgram();

datasourcesCommand
  .command('pull [datasourceName]')
  .option('-f, --filename <filename>', 'custom name to be used in file(s) name instead of space id')
  .option('--sf, --separate-files', 'Argument to create a single file for each datasource')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. datasources.<suffix>.json)')
  .description('Pull datasources from your space')
  .action(async (datasourceName: string | undefined /* options: PullDatasourcesOptions */) => {
    konsola.title(` ${commands.DATASOURCES} `, colorPalette.DATASOURCES, datasourceName ? `Pulling datasource ${datasourceName}...` : 'Pulling datasources...');

    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space /* path */ } = datasourcesCommand.opts();
    /* const { separateFiles, suffix, filename = 'datasources' } = options; */

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
      token: password,
      region,
    });

    const spinnerDatasources = new Spinner({
      verbose: !isVitest,
    });

    try {
      spinnerDatasources.start(`Fetching ${chalk.hex(colorPalette.DATASOURCES)('datasources')}`);

      const datasources = await fetchDatasources(space);

      spinnerDatasources.succeed(`${chalk.hex(colorPalette.DATASOURCES)('Datasources')} - Completed in ${spinnerDatasources.elapsedTime.toFixed(2)}ms`);
      console.log(datasources);
    }
    catch (error) {
      konsola.br();
      handleError(error as Error, verbose);
    }
  });
