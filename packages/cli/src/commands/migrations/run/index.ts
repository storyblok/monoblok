import { getProgram } from '../../../program';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../utils/logger';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import type { MigrationsRunOptions } from './constants';
import { migrationsCommand } from '../command';
import { createStoriesStream } from './streams/stories-stream';
import { readMigrationFiles } from './actions';
import { MigrationStream } from './streams/migrations-transform';
import { UpdateStream } from './streams/update-stream';
import { mapiClient } from '../../../api';
import { pipeline } from 'node:stream';

migrationsCommand.command('run [componentName]')
  .description('Run migrations')
  .option('--fi, --filter <filter>', 'glob filter to apply to the components before pushing')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('-q, --query <query>', 'Filter stories by content attributes using Storyblok filter query syntax. Example: --query="[highlighted][in]=true"')
  .option('--starts-with <path>', 'Filter stories by path. Example: --starts-with="/en/blog/"')
  .option('--publish <publish>', 'Options for publication mode: all | published | published-with-changes')
  .option('--ui [enable]', 'Enable or disable pretty console output (enabled by default)', true)
  .option('--no-ui', 'Disable pretty console output', false)
  // Logging options
  .option('--log-console [enable]', 'Enable console logging', false)
  .option('--no-log-console', 'Disable console logging', false)
  .option('--log-console-level <level>', 'Console log level', 'info')
  .action(async (componentName: string | undefined, options: MigrationsRunOptions) => {
    const program = getProgram();
    const ui = getUI();
    const logger = getLogger();

    ui.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, componentName ? `Running migrations for component ${componentName}...` : 'Running migrations...');
    logger.info('Migration started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const verbose = program.opts().verbose;
    const { space, path } = migrationsCommand.opts();
    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const { filter, dryRun = false, query, startsWith, publish } = options;
    const { password, region } = state;

    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    try {
      const spinner = ui.createSpinner(`Fetching migration files and stories...`);

      const migrationFiles = await readMigrationFiles({
        space,
        path,
        filter,
      });
      const filteredMigrations = componentName
        ? migrationFiles.filter((file) => {
            // Match any migration file that starts with the component name and is followed by either
            // the end of the filename or a dot
            return file.name.match(new RegExp(`^${componentName}(\\..*)?\.js$`));
          })
        : migrationFiles;

      if (filteredMigrations.length === 0) {
        spinner.failed(`No migration files found${componentName ? ` for component "${componentName}"` : ''}${filter ? ` matching filter "${filter}"` : ''} in space "${space}".`);
        logger.warn('No migration files found');
        logger.info('Migration finished');
        return;
      }

      // Spinner doesn't have update method, so we'll stop and start a new one
      spinner.succeed(`Found ${filteredMigrations.length} migration files.`);
      const storiesProgress = ui.createProgressBar({ title: 'Fetching Stories...'.padEnd(19) });
      const migrationsProgress = ui.createProgressBar({ title: 'Applying Migrations'.padEnd(19) });
      const updateProgress = ui.createProgressBar({ title: 'Updating Stories...'.padEnd(19) });

      const storiesStream = await createStoriesStream({
        spaceId: space,
        params: {
          componentName,
          query,
          starts_with: startsWith,
        },
        batchSize: 12,
        onTotal: (total) => {
          storiesProgress.setTotal(total);
          migrationsProgress.setTotal(total);
        },
        onProgress: () => {
          storiesProgress.increment();
        },
      });

      const migrationStream = new MigrationStream({
        migrationFiles: filteredMigrations,
        space,
        path,
        componentName,
        onTotal: (total) => {
          updateProgress.setTotal(total);
        },
        onProgress: () => {
          migrationsProgress.increment();
        },
      });

      const updateStream = new UpdateStream({
        space,
        publish,
        dryRun,
        batchSize: 12,
        onProgress: () => {
          updateProgress.increment();
        },
      });

      await new Promise<void>((resolve, reject) => {
        pipeline(
          storiesStream,
          migrationStream,
          updateStream,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          },
        );
      });

      ui.stopAllProgressBars();

      // Show migration summary
      const migrationSummary = migrationStream.getSummary();
      ui.info(migrationSummary);

      // Show update summary
      const updateSummary = updateStream.getSummary();
      ui.info(updateSummary);

      const migrationResults = migrationStream.getResults();
      const updateResults = updateStream.getResults();

      logger.info('Migration finished', {
        migrationResults: {
          total: migrationResults.totalProcessed,
          succeeded: migrationResults.successful.length,
          skipped: migrationResults.skipped.length,
          failed: migrationResults.failed.length,
        },
        updateResults: {
          total: updateResults.totalProcessed,
          succeeded: updateResults.successful.length,
          failed: updateResults.failed.length,
        },
      });
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
