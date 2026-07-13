import type { Command } from 'commander';
import { minimatch } from 'minimatch';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, konsola, requireAuthentication } from '../../../utils';
import { datasourcesCommand } from '../command';
import type { PushDatasourcesOptions } from './constants';
import { session } from '../../../session';
import chalk from 'chalk';
import type { SpaceDatasource, SpaceDatasourcesDataState } from '../constants';
import { deleteDatasourceEntry, readDatasourcesFiles, updateDatasourceEntryDimension, upsertDatasource, upsertDatasourceEntry } from './actions';
import { fetchDatasources } from '../pull/actions';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';

/**
 * Compares two per-dimension value maps for equality, treating an absent map
 * as empty.
 */
function dimensionValuesEqual(a?: Record<string, string>, b?: Record<string, string>): boolean {
  const aKeys = Object.keys(a ?? {});
  const bKeys = Object.keys(b ?? {});
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(key => a?.[key] === b?.[key]);
}

const pushCmd = datasourcesCommand
  .command('push [datasourceName]')
  .description(`Push your space's datasources schema as json`)
  .option('-f, --from <from>', 'source space id')
  .option('--fi, --filter <filter>', 'glob filter to apply to the datasources before pushing')
  .option('--sf, --separate-files', 'Read from separate files instead of consolidated files')
  .option('--su, --suffix <suffix>', 'Load only files matching *.<suffix>.json (e.g. datasources.dev.json)')
  .option('-s, --space <space>', 'space ID');

pushCmd
  .action(async (datasourceName: string | undefined, options: PushDatasourcesOptions, command: Command) => {
    konsola.title(`${commands.DATASOURCES}`, colorPalette.DATASOURCES, datasourceName ? `Pushing datasource ${datasourceName}...` : 'Pushing datasources...');

    const { space, path, verbose } = command.optsWithGlobals();

    const { filter } = options;
    const fromSpace = options.from || space;

    // Check if the user is logged in
    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    // Check if the space is provided
    if (!space) {
      handleError(new CommandError(`Please provide the target space as argument --space TARGET_SPACE_ID.`), verbose);
      return;
    }
    const logger = getLogger();
    logger.info('Pushing datasources started', { space, fromSpace, datasourceName, filter });

    konsola.info(`Attempting to push datasources ${chalk.bold('from')} space ${chalk.hex(colorPalette.DATASOURCES)(fromSpace)} ${chalk.bold('to')} ${chalk.hex(colorPalette.DATASOURCES)(space)}`);
    konsola.br();

    try {
      // Read datasources data from source space (from option or target space)
      const spaceState: SpaceDatasourcesDataState = {
        local: await readDatasourcesFiles({
          ...options,
          path,
          from: fromSpace,
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
        // Fall back to substring matching when the filter contains no glob special characters (backward compatibility)
        const isGlobPattern = /[*?[\]{}!]/.test(filter);
        spaceState.local.datasources = spaceState.local.datasources.filter(datasource =>
          isGlobPattern ? minimatch(datasource.name, filter) : datasource.name.includes(filter));
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

      const ui = getUI();

      for (const datasource of spaceState.local.datasources) {
        const spinner = ui.createSpinner(`Pushing ${chalk.hex(colorPalette.DATASOURCES)(datasource.name)}`);

        // Check if datasource already exists in target space by name
        const existingDatasource = spaceState.target.datasources.get(datasource.name);
        const existingId = existingDatasource?.id;

        // Extract entries to handle separately (entries are not part of datasource definition)
        const { entries, ...datasourceDefinition } = datasource;

        const result = await upsertDatasource(space, datasourceDefinition, existingId);
        if (result) {
          results.successful.push(datasource.name);

          // Sync entries: upsert all local entries with position, then delete stale target entries
          const localEntries = entries ?? [];
          const existingEntries = existingDatasource?.entries ?? [];

          // Index existing entries by name with their position for O(1) lookup
          const existingEntryMap = new Map(existingEntries.map((e, idx) => [e.name, { entry: e, position: idx + 1 }]));

          for (let i = 0; i < localEntries.length; i++) {
            const entry = localEntries[i];
            const existing = existingEntryMap.get(entry.name);
            const existingEntryId = existing?.entry.id;
            const targetPosition = i + 1;

            // Skip update when all mutable fields, per-dimension values, and position are identical
            if (existing
              && existing.entry.value === entry.value
              && dimensionValuesEqual(existing.entry.dimension_values, entry.dimension_values)
              && existing.position === targetPosition) {
              logger.info('Skipped datasource entry (unchanged)', { datasource: datasource.name, entry: entry.name, position: targetPosition });
              continue;
            }

            try {
              const upserted = await upsertDatasourceEntry(space, result.id, entry, existingEntryId, i + 1);
              const entryId = existingEntryId ?? upserted?.id;
              logger.info(existingEntryId ? 'Updated datasource entry' : 'Created datasource entry', { datasource: datasource.name, entry: entry.name, position: i + 1 });

              // Write per-dimension values. Iterate the union of local and target
              // dimension codes so values removed locally are cleared (blank) too.
              if (entryId != null) {
                const localDimensionValues = entry.dimension_values ?? {};
                const targetDimensionValues = existing?.entry.dimension_values ?? {};
                const dimensionCodes = new Set([...Object.keys(localDimensionValues), ...Object.keys(targetDimensionValues)]);

                for (const code of dimensionCodes) {
                  const localValue = localDimensionValues[code] ?? '';
                  const targetValue = targetDimensionValues[code] ?? '';
                  // Skip dimensions already in sync to avoid redundant writes (e.g. when only the default value or position changed).
                  if (localValue === targetValue) {
                    continue;
                  }
                  const dimension = result.dimensions?.find(d => d.entry_value === code);
                  if (!dimension?.id) {
                    konsola.warn(`Skipping dimension "${code}" for entry "${entry.name}": no matching dimension in target space ${space}`);
                    continue;
                  }
                  await updateDatasourceEntryDimension(space, entryId, entry, dimension.id, localValue);
                }
              }
            }
            catch (entryError) {
              results.failed.push({ name: datasource.name, error: entryError });
              spinner.failed(`${chalk.hex(colorPalette.DATASOURCES)(datasource.name)} - Failed in ${spinner.elapsedTime.toFixed(2)}ms`);
            }
          }

          // Delete target entries that are not present in the local source
          const localEntryNames = new Set(localEntries.map(e => e.name));
          const staleEntries = existingEntries.filter(e => !localEntryNames.has(e.name));
          for (const stale of staleEntries) {
            try {
              await deleteDatasourceEntry(space, stale.id);
              logger.info('Deleted datasource entry', { datasource: datasource.name, entry: stale.name, entryId: stale.id });
            }
            catch (entryError) {
              results.failed.push({ name: datasource.name, error: entryError });
              spinner.failed(`${chalk.hex(colorPalette.DATASOURCES)(datasource.name)} - Failed in ${spinner.elapsedTime.toFixed(2)}ms`);
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
    finally {
      logger.info('Pushing datasources finished', { space, fromSpace });
    }
  });
