import { Sema } from 'async-sema';
import { colorPalette, commands } from '../../../constants';
import { assetsCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { session } from '../../../session';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, logOnlyError, toError } from '../../../utils/error/error';
import { transferAsset } from '../actions';

interface TransferResult {
  assetId: number;
  status: 'transferred' | 'failed';
  filename?: string;
  reason?: string;
}

const transferCmd = assetsCommand
  .command('transfer <asset-id...>')
  .option('-s, --space <space>', 'space ID')
  .option('--folder-id <folderId>', 'destination asset folder ID in the global library')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .description(`Transfer space assets into the organization's global asset library.`);

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

    const ids = assetIds.map(id => Number(id)).filter(id => !Number.isNaN(id));
    if (ids.length === 0) {
      handleError(new CommandError(`Please provide at least one valid asset ID.`), verbose);
      process.exitCode = 2;
      return;
    }

    const summary = { total: ids.length, succeeded: 0, failed: 0 };

    if (options.dryRun) {
      ui.info(`Transfer plan: ${ids.length} asset(s) to folder ${folderId}`);
      ui.list(ids.map(id => `${id} -> folder ${folderId}`));
      reporter.addSummary('transferResults', summary);
      reporter.finalize();
      logger.info('Transferring assets finished (dry run)', { summary });
      process.exitCode = 0;
      return;
    }

    // Per-ID errors are captured individually below, so unlike push/pull this
    // command needs no outer fatalError try/catch wrapper.
    const lock = new Sema(12);
    const results = await Promise.all(ids.map(async (assetId): Promise<TransferResult> => {
      await lock.acquire();
      try {
        const asset = await transferAsset(space, assetId, folderId);
        logger.info('Transferred asset', { assetId, filename: asset.filename });
        return { assetId, status: 'transferred', filename: asset.filename };
      }
      catch (maybeError) {
        const error = toError(maybeError);
        logOnlyError(error, { assetId });
        return { assetId, status: 'failed', reason: error.message };
      }
      finally {
        lock.release();
      }
    }));

    for (const result of results) {
      if (result.status === 'transferred') {
        summary.succeeded += 1;
      }
      else {
        summary.failed += 1;
      }
    }

    ui.info(`Transfer results: ${summary.total} processed, ${summary.failed} failed`);
    ui.list(results.map(result => result.status === 'transferred'
      ? `${result.assetId}  ✓ transferred -> ${result.filename}`
      : `${result.assetId}  ✗ failed: ${result.reason}`));

    reporter.addSummary('transferResults', summary);
    reporter.finalize();
    logger.info('Transferring assets finished', { summary });

    process.exitCode = summary.failed > 0 ? 1 : 0;
  });
