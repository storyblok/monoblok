import { datasourcesCommand } from '../command';
import { deleteDatasource } from './actions';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { colorPalette, commands } from '../../../constants';
import chalk from 'chalk';
import { Spinner } from '@topcli/spinner';
import type { DeleteDatasourceOptions } from './constants';
import { mapiClient } from '../../../api';
import { fetchDatasource } from '../pull/actions';
import { confirm } from '@inquirer/prompts';

// Register the delete command under datasources
// Usage: storyblok datasources delete <name> --space <SPACE_ID> [--id <ID>]
datasourcesCommand
  .command('delete [name]')
  .description('Delete a datasource from your space by name or id')
  .option('--id <id>', 'Delete by datasource id instead of name')
  .option('--force', 'Skip confirmation prompt for deletion (useful for CI)')
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
      // Use id if provided, otherwise use name
      if (options.id) {
        // Delete by id
        spinner.start(`Deleting datasource...`);
        await deleteDatasource(space, options.id);
        spinner.succeed();
        konsola.ok(`Datasource ${chalk.hex(colorPalette.DATASOURCES)(options.id)} deleted successfully from space ${space}.`);
      }
      else {
        // Delete by name
        const datasource = await fetchDatasource(space, name);
        if (!datasource) {
          throw new CommandError(`Datasource with name '${name}' not found in space ${space}.`);
        }
        // If --force is not set, prompt for confirmation
        if (!options.force) {
          // Echo datasource details to the user for confirmation
          konsola.info(`Datasource details:`);
          console.log(`  Name: ${chalk.hex(colorPalette.DATASOURCES)(datasource.name)}`);
          console.log(`  ID: ${chalk.hex(colorPalette.DATASOURCES)(datasource.id)}`);
          console.log(`  Space: ${chalk.hex(colorPalette.DATASOURCES)(space)}`);
          console.log(`  Slug: ${chalk.hex(colorPalette.DATASOURCES)(datasource.slug)}`);
          console.log(`  Created at: ${chalk.hex(colorPalette.DATASOURCES)(datasource.created_at)}`);
          console.log(`  Updated at: ${chalk.hex(colorPalette.DATASOURCES)(datasource.updated_at)}`);
          konsola.br();
          // Ask for confirmation
          const confirmed = await confirm({
            message: `⚠️ ${chalk.yellow(` Are you sure you want to delete the ${datasource.name} datasource from space ${space}? This action cannot be undone.`)} `,
            default: false,
          });
          if (!confirmed) {
            spinner.failed('Deletion aborted by user.');
            konsola.warn('Deletion aborted by user.');
            return;
          }
        }
        spinner.start(`Deleting datasource...`);
        await deleteDatasource(space, datasource.id.toString());
        spinner.succeed();
        konsola.ok(`Datasource ${chalk.hex(colorPalette.DATASOURCES)(name)} deleted successfully from space ${space}.`);
      }
    }
    catch (error) {
      spinner.failed(
        `Failed to delete datasource ${chalk.hex(colorPalette.DATASOURCES)(options.id ? options.id : name)}`,
      );
      handleError(error as Error, verbose);
    }
  });
