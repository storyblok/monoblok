import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { getProgram } from '../../../program';
import { datasourcesCommand } from '../command';
import type { PushDatasourcesOptions } from './constants';
import { session } from '../../../session';
import chalk from 'chalk';
import { mapiClient } from '../../../api';
import type { SpaceDatasource, SpaceDatasourcesDataState } from '../constants';
import { readDatasourcesFiles, upsertDatasource, upsertDatasourceEntry } from './actions';
import { fetchDatasources } from '../pull/actions';
import { Spinner } from '@topcli/spinner';

const program = getProgram(); // Get the shared singleton instance

datasourcesCommand
  .command('push [datasourceName]')
  .description(`Push your space's datasources schema as json`)
  .option('-f, --from <from>', 'source space id')
  .option('--fi, --filter <filter>', 'glob filter to apply to the datasources before pushing')
  .option('--sf, --separate-files', 'Read from separate files instead of consolidated files')
  .option('--su, --suffix <suffix>', 'Suffix to add to the datasource name')
  .action(async (datasourceName: string | undefined, options: PushDatasourcesOptions) => {
    konsola.title(`${commands.DATASOURCES}`, colorPalette.DATASOURCES, datasourceName ? `Pushing datasource ${datasourceName}...` : 'Pushing datasources...');
    // Global options
    const verbose = program.opts().verbose;
    const { space, path } = datasourcesCommand.opts();

    const { filter } = options;
    const fromSpace = options.from || space;

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
    konsola.info(`Attempting to push datasources ${chalk.bold('from')} space ${chalk.hex(colorPalette.DATASOURCES)(fromSpace)} ${chalk.bold('to')} ${chalk.hex(colorPalette.DATASOURCES)(space)}`);
    konsola.br();

    const { password, region } = state;

    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    try {
      // Read datasources data from source space (from option or target space)
      const spaceState: SpaceDatasourcesDataState = {
        local: await readDatasourcesFiles({
          ...options,
          path,
          space,
        }),
        target: {
          datasources: new Map(),
        },
      };

      const targetSpaceDatasources = await fetchDatasources(space);

      if (targetSpaceDatasources) {
        (targetSpaceDatasources as SpaceDatasource[]).forEach((datasource) => {
          spaceState.target.datasources.set(datasource.name, datasource);
        });
      }

      if (datasourceName) {
        spaceState.local = {
          datasources: [spaceState.local.datasources.find(datasource => datasource.name === datasourceName) || [] as unknown as SpaceDatasource],
        };
        if (!spaceState.local.datasources.length) {
          handleError(new CommandError(`Datasource "${datasourceName}" not found.`), verbose);
          return;
        }
      }
      else if (filter) {
        spaceState.local.datasources = spaceState.local.datasources.filter(datasource => datasource.name.includes(filter));
        if (!spaceState.local.datasources.length) {
          handleError(new CommandError(`No datasources found matching pattern "${filter}".`), verbose);
          return;
        }
        konsola.info(`Filter applied: ${filter}`);
      }

      if (!spaceState.local.datasources.length) {
        konsola.warn('No datasources found. Please make sure you have pulled the datasources first.');
        return;
      }

      const results = {
        successful: [] as string[],
        failed: [] as Array<{ name: string; error: unknown }>,
      };

      for (const datasource of spaceState.local.datasources) {
        const spinner = new Spinner({
          verbose: !isVitest,
        });

        spinner.start(`Pushing ${chalk.hex(colorPalette.DATASOURCES)(datasource.name)}`);

        // Check if datasource already exists in target space by name
        const existingDatasource = spaceState.target.datasources.get(datasource.name);
        const existingId = existingDatasource?.id;

        // Extract entries to handle separately (entries are not part of datasource definition)
        const { entries, ...datasourceDefinition } = datasource;

        const result = await upsertDatasource(space, datasourceDefinition, existingId);
        if (result) {
          results.successful.push(datasource.name);

          // Handle entries if they exist
          if (entries && entries.length > 0) {
            for (const entry of entries) {
              const existingEntryId = existingDatasource?.entries?.find(e => e.name === entry.name)?.id;
              try {
                await upsertDatasourceEntry(space, result.id, entry, existingEntryId);
              }
              catch (entryError) {
                results.failed.push({ name: datasource.name, error: entryError });
                spinner.failed(`${chalk.hex(colorPalette.DATASOURCES)(datasource.name)} - Failed in ${spinner.elapsedTime.toFixed(2)}ms`);
              }
            }
          }

          spinner.succeed(`${chalk.hex(colorPalette.DATASOURCES)(datasource.name)} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`);
        }
        else {
          results.failed.push({ name: datasource.name, error: result });
          spinner.failed(`${chalk.hex(colorPalette.DATASOURCES)(datasource.name)} - Failed in ${spinner.elapsedTime.toFixed(2)}ms`);
        }
      }

      if (results.failed.length > 0) {
        if (!verbose) {
          konsola.br();
          konsola.info('For more information about the error, run the command with the `--verbose` flag');
        }
        else {
          results.failed.forEach((failed) => {
            handleError(failed.error as Error, verbose);
          });
        }
      }
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
