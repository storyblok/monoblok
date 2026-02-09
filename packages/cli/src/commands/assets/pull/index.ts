import { pipeline } from 'node:stream/promises';
import { colorPalette, commands, directories } from '../../../constants';
import { assetsCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { resolveCommandPath } from '../../../utils/filesystem';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, logOnlyError, toError } from '../../../utils/error/error';
import {
  downloadAssetStream,
  fetchAssetFoldersStream,
  fetchAssetsStream,
  makeWriteAssetFolderFSTransport,
  makeWriteAssetFSTransport,
  writeAssetFolderStream,
  writeAssetStream,
} from '../streams';

assetsCommand
  .command('pull')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('-q, --query <query>', 'Filter assets using Storyblok filter query syntax. Example: --query="search=my-file.jpg&with_tags=tag1,tag2"')
  .option('--asset-token <token>', 'Asset token for accessing private assets')
  .description(`Download your space's assets as local files.`)
  .action(async (options, command) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(`${commands.ASSETS}`, colorPalette.ASSETS, 'Pulling assets...');
    logger.info('Pulling assets started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const assetToken = options.assetToken as string | undefined;
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

    const { region } = state;

    const summary = {
      folderResults: { total: 0, succeeded: 0, failed: 0 },
      fetchAssetPages: { total: 0, succeeded: 0, failed: 0 },
      fetchAssets: { total: 0, succeeded: 0, failed: 0 },
      save: { total: 0, succeeded: 0, failed: 0 },
    };

    let fatalError = false;

    try {
      const folderProgress = ui.createProgressBar({ title: 'Folders...'.padEnd(25) });
      const fetchAssetPagesProgress = ui.createProgressBar({ title: 'Fetching Asset Pages...'.padEnd(24) });
      const fetchAssetsProgress = ui.createProgressBar({ title: 'Fetching Assets...'.padEnd(24) });
      const saveProgress = ui.createProgressBar({ title: 'Saving Assets...'.padEnd(24) });
      await pipeline(
        fetchAssetFoldersStream({
          spaceId: space,
          setTotalFolders: (total) => {
            summary.folderResults.total = total;
            folderProgress.setTotal(total);
          },
          onSuccess: () => {
            logger.info('Fetched asset folders');
          },
          onError: (error) => {
            summary.folderResults.failed += 1;
            summary.folderResults.total = summary.folderResults.total || 1;
            folderProgress.setTotal(summary.folderResults.total);
            logOnlyError(error);
          },
        }),
        writeAssetFolderStream({
          writeAssetFolder: options.dryRun
            ? async folder => folder
            : makeWriteAssetFolderFSTransport({
                directoryPath: resolveCommandPath(directories.assets, space, basePath),
              }),
          onIncrement: () => {
            folderProgress.increment();
          },
          onFolderSuccess: (folder) => {
            logger.info('Saved folder', { folderId: folder.id });
            summary.folderResults.succeeded += 1;
          },
          onFolderError: (error, folder) => {
            summary.folderResults.failed += 1;
            summary.folderResults.total = Math.max(summary.folderResults.total, summary.folderResults.succeeded + summary.folderResults.failed);
            logOnlyError(error, { folderId: folder.id });
          },
        }),
      );
      await pipeline(
        fetchAssetsStream({
          spaceId: space,
          params: options.query ? Object.fromEntries(new URLSearchParams(options.query)) : {},
          setTotalAssets: (total) => {
            summary.fetchAssets.total = total;
            summary.save.total = total;
            fetchAssetsProgress.setTotal(total);
            saveProgress.setTotal(total);
          },
          setTotalPages: (totalPages) => {
            summary.fetchAssetPages.total = totalPages;
            fetchAssetPagesProgress.setTotal(totalPages);
          },
          onIncrement: () => {
            fetchAssetPagesProgress.increment();
          },
          onPageSuccess: (page, totalPages) => {
            logger.info(`Fetched assets page ${page} of ${totalPages}`);
            summary.fetchAssetPages.succeeded += 1;
          },
          onPageError: (error, page, totalPages) => {
            summary.fetchAssetPages.failed += 1;
            logOnlyError(error, { page, totalPages });
          },
        }),
        downloadAssetStream({
          assetToken,
          region,
          onIncrement: () => {
            fetchAssetsProgress.increment();
          },
          onAssetSuccess: (asset) => {
            logger.info('Fetched asset', { assetId: asset.id });
            summary.fetchAssets.succeeded += 1;
          },
          onAssetError: (error, asset) => {
            summary.fetchAssets.failed += 1;
            summary.save.total -= 1;
            saveProgress.setTotal(summary.save.total);
            logOnlyError(error, { assetId: asset.id });
          },
        }),
        writeAssetStream({
          writeAsset: options.dryRun
            ? async asset => asset
            : makeWriteAssetFSTransport({
                directoryPath: resolveCommandPath(directories.assets, space, basePath),
              }),
          onIncrement: () => {
            saveProgress.increment();
          },
          onAssetSuccess: (asset) => {
            logger.info('Saved asset', { assetId: asset.id });
            summary.save.succeeded += 1;
          },
          onAssetError: (error, asset) => {
            summary.save.failed += 1;
            logOnlyError(error, { assetId: asset.id });
          },
        }),
      );
    }
    catch (maybeError) {
      fatalError = true;
      handleError(toError(maybeError));
    }
    finally {
      logger.info('Pulling assets finished', summary);
      ui.stopAllProgressBars();
      const failedAssets = Math.max(summary.fetchAssets.failed, summary.save.failed);
      const folderSummary = {
        total: summary.folderResults.total,
        succeeded: summary.folderResults.succeeded,
        failed: summary.folderResults.failed,
      };
      ui.info(`Pull results: ${summary.save.total} assets pulled, ${failedAssets} assets failed`);
      ui.list([
        `Folders: ${folderSummary.succeeded}/${folderSummary.total} succeeded, ${folderSummary.failed} failed.`,
        `Fetching pages: ${summary.fetchAssetPages.succeeded}/${summary.fetchAssetPages.total} succeeded, ${summary.fetchAssetPages.failed} failed.`,
        `Fetching assets: ${summary.fetchAssets.succeeded}/${summary.fetchAssets.total} succeeded, ${summary.fetchAssets.failed} failed.`,
        `Saving assets: ${summary.save.succeeded}/${summary.save.total} succeeded, ${summary.save.failed} failed.`,
      ]);

      const reporter = getReporter();
      reporter.addSummary('folderResults', folderSummary);
      reporter.addSummary('fetchAssetPagesResults', summary.fetchAssetPages);
      reporter.addSummary('fetchAssetsResults', summary.fetchAssets);
      reporter.addSummary('saveResults', summary.save);
      reporter.finalize();

      const failedTotal = summary.folderResults.failed
        + summary.fetchAssetPages.failed
        + summary.fetchAssets.failed
        + summary.save.failed;
      process.exitCode = fatalError ? 2 : failedTotal > 0 ? 1 : 0;
    }
  });
