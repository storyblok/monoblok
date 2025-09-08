import { Spinner } from '@topcli/spinner';
import { getProgram } from '../../../program';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import type { MigrationsRunOptions } from './constants';
import { migrationsCommand } from '../command';
import { createStoriesStream } from './streams/stories-stream';
import { readMigrationFiles } from './actions';
import { MigrationStream } from './streams/migrations-transform';
import { UpdateStream } from './streams/update-stream';
import { mapiClient } from '../../../api';
import { MultiBar, Presets } from 'cli-progress';
import { pipeline } from 'node:stream';
import chalk from 'chalk';

const program = getProgram();

migrationsCommand.command('run [componentName]')
  .description('Run migrations')
  .option('--fi, --filter <filter>', 'glob filter to apply to the components before pushing')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('-q, --query <query>', 'Filter stories by content attributes using Storyblok filter query syntax. Example: --query="[highlighted][in]=true"')
  .option('--starts-with <path>', 'Filter stories by path. Example: --starts-with="/en/blog/"')
  .option('--publish <publish>', 'Options for publication mode: all | published | published-with-changes')
  .action(async (componentName: string | undefined, options: MigrationsRunOptions) => {
    konsola.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, componentName ? `Running migrations for component ${componentName}...` : 'Running migrations...');

    // Global options
    const verbose = program.opts().verbose;

    const { filter, dryRun = false, query, startsWith, publish } = options;

    // Command options
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

    const { password, region } = state;

    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    try {
      const spinner = new Spinner({
        verbose: !isVitest,
      }).start(`Fetching migration files and stories...`);

      // Read migration files
      const migrationFiles = await readMigrationFiles({
        space,
        path,
        filter,
      });

      if (migrationFiles.length === 0) {
        spinner.failed(`No migration files found for space "${space}"${filter ? ` matching filter "${filter}"` : ''}.`);
        return;
      }

      // Filter migrations based on component name if provided
      const filteredMigrations = componentName
        ? migrationFiles.filter((file) => {
            // Match any migration file that starts with the component name and is followed by either
            // the end of the filename or a dot
            return file.name.match(new RegExp(`^${componentName}(\\..*)?\.js$`));
          })
        : migrationFiles;

      if (filteredMigrations.length === 0) {
        spinner.failed(`No migration files found${componentName ? ` for component "${componentName}"` : ''}${filter ? ` matching filter "${filter}"` : ''} in space "${space}".`);
        return;
      }

      // Spinner doesn't have update method, so we'll stop and start a new one
      spinner.succeed(`Found ${filteredMigrations.length} migration files.`);

      const multiBar = new MultiBar({
        clearOnComplete: false,
        format: `${chalk.bold(' {title} ')} ${chalk.hex(colorPalette.PRIMARY)('[{bar}]')} {percentage}% | {value}/{total} processed`,
      }, Presets.rect);

      const storiesProgress = multiBar.create(0, 0, {
        title: 'Fetching Stories...'.padEnd(19),
      });
      const migrationsProgress = multiBar.create(0, 0, {
        title: 'Applying Migrations'.padEnd(19),
      });
      const updateProgress = multiBar.create(0, 0, {
        title: 'Updating Stories...'.padEnd(19),
      });

      const storiesStream = await createStoriesStream({
        spaceId: space,
        params: {
          componentName,
          query,
          starts_with: startsWith,
        },
        batchSize: 100,
        onTotal: (total) => {
          storiesProgress.setTotal(total);
          migrationsProgress.setTotal(total);
        },
        onProgress: () => storiesProgress.increment(),
      });

      const migrationStream = new MigrationStream({
        migrationFiles: filteredMigrations,
        space,
        path,
        componentName,
        onTotal: (total) => {
          updateProgress.setTotal(total);
        },
        onProgress: () => migrationsProgress.increment(),
      });

      const updateStream = new UpdateStream({
        space,
        publish,
        dryRun,
        batchSize: 100,
        onProgress: () => updateProgress.increment(),
      });

      return new Promise<void>((resolve, reject) => {
        pipeline(
          storiesStream,
          migrationStream,
          updateStream,
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            multiBar.stop();

            // Show migration summary
            const migrationSummary = migrationStream.getSummary();
            konsola.info(migrationSummary);

            // Show update summary
            const updateSummary = updateStream.getSummary();
            konsola.info(updateSummary);

            resolve();
          },
        );
      });
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
