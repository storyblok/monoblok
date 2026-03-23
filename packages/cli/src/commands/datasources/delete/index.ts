import type { Command } from 'commander';
import { datasourcesCommand } from '../command';
import { deleteDatasource } from './actions';
import { CommandError, handleError, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { colorPalette, commands } from '../../../constants';
import chalk from 'chalk';
import type { DeleteDatasourceOptions } from './constants';
import { fetchDatasource } from '../pull/actions';
import { confirm } from '@inquirer/prompts';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
// Register the delete command under datasources
// Usage: storyblok datasources delete <name> --space <SPACE_ID> [--id <ID>]
const deleteCmd = datasourcesCommand
  .command('delete [name]')
  .description('Delete a datasource from your space by name or id')
  .option('--id <id>', 'Delete by datasource id instead of name')
  .option('--force', 'Skip confirmation prompt for deletion (useful for CI)')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

deleteCmd
  .action(async (name: string, options: DeleteDatasourceOptions, command: Command) => {
    konsola.title(
      `${commands.DATASOURCES}`,
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
    const { space, verbose } = command.optsWithGlobals();

    // Authenticate user
    const { state } = session();
    if (!requireAuthentication(state, verbose)) { return; }
    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space YOUR_SPACE_ID.'), verbose);
      return;
    }

    const ui = getUI();
    const logger = getLogger();
    logger.info('Deleting datasource started', { space, name, id: options.id });

    try {
      // Use id if provided, otherwise use name
      if (options.id) {
        // Delete by id
        const spinner = ui.createSpinner(`Deleting datasource...`);
        await deleteDatasource(space, options.id);
        spinner.succeed(`Datasource deleted`);
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
            konsola.warn('Deletion aborted by user.');
            return;
          }
        }
        const spinner = ui.createSpinner(`Deleting datasource...`);
        await deleteDatasource(space, datasource.id.toString());
        spinner.succeed(`Datasource deleted`);
        konsola.ok(`Datasource ${chalk.hex(colorPalette.DATASOURCES)(name)} deleted successfully from space ${space}.`);
      }
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
    finally {
      logger.info('Deleting datasource finished', { space, name, id: options.id });
    }
  });
