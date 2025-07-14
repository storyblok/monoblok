import { datasourcesCommand } from '../command';
import { deleteDatasourceByNameOrId } from './actions';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { colorPalette, commands } from '../../../constants';
import chalk from 'chalk';
import { Spinner } from '@topcli/spinner';
import type { DeleteDatasourceOptions } from './constants';
import { mapiClient } from '../../../api';

// Register the delete command under datasources
// Usage: storyblok datasources delete <name> --space <SPACE_ID> [--id <ID>]
datasourcesCommand
  .command('delete [name]')
  .description('Delete a datasource from your space by name or id')
  .option('--id <id>', 'Delete by datasource id instead of name')
  .action(async (name: string, options: DeleteDatasourceOptions) => {
    konsola.title(
      ` ${commands.DATASOURCES} `,
      colorPalette.DATASOURCES,
      options.id
        ? `Deleting datasource with id ${options.id}...`
        : `Deleting datasource with name ${name}...`,
    );

    // Warn if both name and id are provided
    if (name && options.id) {
      konsola.warn(
        'Both a datasource name and an id were provided. Only one is required. The id will be used as the source of truth.',
      );
    }

    // Get global options
    const { space } = datasourcesCommand.opts();
    const verbose = datasourcesCommand.parent?.opts().verbose;

    // Authenticate user
    const { state, initializeSession } = session();
    await initializeSession();
    if (!requireAuthentication(state, verbose)) { return; }
    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space YOUR_SPACE_ID.'), verbose);
      return;
    }

    const { password, region } = state;
    mapiClient({
      token: password,
      region,
    });

    const spinner = new Spinner({
      verbose: !isVitest,
    });

    try {
      spinner.start(`Deleting datasource...`);
      await deleteDatasourceByNameOrId(space, name, options.id);
      spinner.succeed(
        `Datasource ${chalk.hex(colorPalette.DATASOURCES)(options.id ? options.id : name)} deleted successfully.`,
      );
    }
    catch (error) {
      spinner.failed(
        `Failed to delete datasource ${chalk.hex(colorPalette.DATASOURCES)(options.id ? options.id : name)}`,
      );
      handleError(error as Error, verbose);
    }
  });
