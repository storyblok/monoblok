import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, konsola, requireAuthentication } from '../../../utils';
import { getProgram } from '../../../program';
import { datasourcesCommand } from '../command';
import type { PushDatasourcesOptions } from './constants';
import { session } from '../../../session';
import chalk from 'chalk';
import { mapiClient } from '../../../api';

const program = getProgram(); // Get the shared singleton instance

datasourcesCommand
  .command('push [datasourceName]')
  .description(`Push your space's datasources schema as json`)
  .option('-f, --from <from>', 'source space id')
  .option('--fi, --filter <filter>', 'glob filter to apply to the datasources before pushing')
  .option('--sf, --separate-files', 'Read from separate files instead of consolidated files')
  .option('--su, --suffix <suffix>', 'Suffix to add to the datasource name')
  .action(async (datasourceName: string | undefined, options: PushDatasourcesOptions) => {
    konsola.title(` ${commands.DATASOURCES} `, colorPalette.DATASOURCES, datasourceName ? `Pushing datasource ${datasourceName}...` : 'Pushing datasources...');
    // Global options
    const verbose = program.opts().verbose;
    const { space /* path */ } = datasourcesCommand.opts();

    // Check if the user is logged in
    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    // Check if the space is provided
    if (!space) {
      handleError(new CommandError(`Please provide the target space as argument --space TARGET_SPACE_ID.`), verbose);
      return;
    }

    konsola.info(`Attempting to push datasources ${chalk.bold('from')} space ${chalk.hex(colorPalette.DATASOURCES)(options.from || space)} ${chalk.bold('to')} ${chalk.hex(colorPalette.DATASOURCES)(space)}`);
    konsola.br();

    const { password, region } = state;

    mapiClient({
      token: password,
      region,
    });

    try {
      console.log('pushing datasources');
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
