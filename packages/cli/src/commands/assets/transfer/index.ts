import { colorPalette, commands } from '../../../constants';
import { assetsCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { session } from '../../../session';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, logOnlyError, toError } from '../../../utils/error/error';
import { fetchAllSpaceAssetIds, transferAssets } from '../actions';

const transferCmd = assetsCommand
  .command('transfer [asset-id...]')
  .option('-s, --space <space>', 'space ID')
  .option('--folder-id <folderId>', 'destination asset folder ID in the shared library')
  .option('--all', 'Transfer every asset in the space to the shared library')
  .option('-q, --query <query>', 'Filter assets using Storyblok filter query syntax. Example: --query="search=my-file.jpg&with_tags=tag1,tag2"')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .description(`Transfer space assets into the organization's shared asset library.`);

transferCmd
  .action(async (assetIds: string[], options, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();

    ui.title(`${commands.ASSETS}`, colorPalette.ASSETS, 'Transferring assets...');
    logger.info('Transferring assets started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space, verbose } = command.optsWithGlobals();
    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      process.exitCode = 2;
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      process.exitCode = 2;
      return;
    }

    const folderId = Number(options.folderId);
    if (!options.folderId || !Number.isFinite(folderId) || folderId <= 0) {
      handleError(new CommandError(`Please provide a destination folder with --folder-id YOUR_FOLDER_ID.`), verbose);
      process.exitCode = 2;
      return;
    }

    if (options.all && assetIds.length > 0) {
      handleError(new CommandError(`Cannot combine --all with explicit asset IDs.`), verbose);
      process.exitCode = 2;
      return;
    }

    if (options.query && !options.all) {
      handleError(new CommandError(`--query can only be used together with --all.`), verbose);
      process.exitCode = 2;
      return;
    }

    let ids: number[];
    if (options.all) {
      const params = options.query ? Object.fromEntries(new URLSearchParams(options.query)) : undefined;
      try {
        ids = await fetchAllSpaceAssetIds(space, params);
      }
      catch (maybeError) {
        handleError(toError(maybeError), verbose);
        process.exitCode = 2;
        return;
      }
      if (ids.length === 0) {
        ui.info(`No assets found in space ${space}. Nothing to transfer.`);
        logger.info('Transferring assets finished (no assets found)');
        process.exitCode = 0;
        return;
      }
    }
    else {
      ids = assetIds.map(id => Number(id)).filter(id => !Number.isNaN(id));
      if (ids.length === 0) {
        handleError(new CommandError(`Please provide at least one valid asset ID, or use --all.`), verbose);
        process.exitCode = 2;
        return;
      }
    }

    if (options.dryRun) {
      const summary = { total: ids.length, succeeded: 0, failed: 0 };
      ui.info(`Transfer plan: ${ids.length} asset(s) to folder ${folderId}`);
      ui.list(ids.map(id => `${id} -> folder ${folderId}`));
      reporter.addSummary('transferResults', summary);
      reporter.finalize();
      logger.info('Transferring assets finished (dry run)', { summary });
      process.exitCode = 0;
      return;
    }

    // Per-ID errors are captured individually, so unlike push/pull this
    // command needs no outer fatalError try/catch wrapper.
    const results = await transferAssets(space, ids, folderId, {
      onSuccess: ({ assetId, filename }) => logger.info('Transferred asset', { assetId, filename }),
      onError: (error, assetId) => logOnlyError(error, { assetId }),
    });

    const succeeded = results.filter(result => result.status === 'transferred').length;
    const summary = { total: results.length, succeeded, failed: results.length - succeeded };

    ui.info(`Transfer results: ${summary.total} processed, ${summary.failed} failed`);
    ui.list(results.map(result => result.status === 'transferred'
      ? `${result.assetId}  ✓ transferred -> ${result.filename}`
      : `${result.assetId}  ✗ failed: ${result.reason}`));

    reporter.addSummary('transferResults', summary);
    reporter.finalize();
    logger.info('Transferring assets finished', { summary });

    process.exitCode = summary.failed > 0 ? 1 : 0;
  });
