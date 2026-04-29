import { resolve } from 'pathe';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { schemaCommand } from '../command';
import type { SchemaPullOptions } from './constants';
import { fetchRemoteSchema } from '../push/actions';
import { writeSchemaFiles } from './actions';

schemaCommand
  .command('pull')
  .description('Bootstrap local TypeScript schema files from an existing Storyblok space')
  .option('-s, --space <space>', 'space ID')
  .option('--out-dir <dir>', 'Output directory for generated bootstrap files', '.storyblok/schema')
  .action(async (options: SchemaPullOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Pulling schema...');
    logger.info('Schema pull started', { space });

    if (!requireAuthentication(state, verbose)) { return; }

    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space SPACE_ID.'), verbose);
      return;
    }

    const summary = { total: 0, succeeded: 0, failed: 0 };

    try {
      // 1. Fetch remote state
      const fetchSpinner = ui.createSpinner(`Fetching schema from space ${space}...`);
      let fetchResult: Awaited<ReturnType<typeof fetchRemoteSchema>>;
      try {
        fetchResult = await fetchRemoteSchema(space);
      }
      catch (maybeError) {
        fetchSpinner.failed('Failed to fetch remote schema');
        handleError(toError(maybeError), verbose);
        return;
      }
      const { rawComponents, rawComponentFolders, rawDatasources } = fetchResult;
      fetchSpinner.succeed(`Found: ${rawComponents.length} components, ${rawComponentFolders.length} component folders, ${rawDatasources.length} datasources`);

      // 2. Generate and write files
      const targetPath = resolve(options.outDir);
      const writeSpinner = ui.createSpinner(`Generating TypeScript files to ${targetPath}...`);
      const writtenFiles = await writeSchemaFiles(targetPath, rawComponents, rawComponentFolders, rawDatasources);

      summary.total = writtenFiles.length;
      summary.succeeded = writtenFiles.length;

      writeSpinner.succeed(`Generated ${writtenFiles.length} files`);
      ui.list(writtenFiles);
      ui.warn('`schema pull` is intended as a bootstrap step for adopting an existing space. Review generated files before continuing.');
      ui.info('After bootstrapping, keep your local schema as the source of truth and use `schema push` for ongoing changes.');
    }
    catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    }
    finally {
      logger.info('Schema pull finished', { summary });
      reporter.addSummary('schemaPullResults', summary);
      reporter.finalize();
    }
  });
