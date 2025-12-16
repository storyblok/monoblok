import { pipeline } from 'node:stream/promises';
import { colorPalette, commands, directories } from '../../../constants';
import { assetsCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { getProgram } from '../../../program';
import { session } from '../../../session';
import { resolveCommandPath } from '../../../utils/filesystem';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, toError } from '../../../utils/error/error';
import { mapiClient } from '../../../api';
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
  .option('-p, --path <path>', 'base path to store assets (default .storyblok)')
  .option('-q, --query <query>', 'Filter assets using Storyblok filter query syntax. Example: --query="[in_folder][eq]=123"')
  .description(`Download your space's assets as local files.`)
  .action(async (options) => {
    const program = getProgram();
    const ui = getUI();
    const logger = getLogger();

    ui.title(`${commands.ASSETS}`, colorPalette.ASSETS, 'Pulling assets...');
    logger.info('Pulling assets started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space } = assetsCommand.opts();
    const basePath = options.path as string | undefined;
    const verbose = program.opts().verbose;
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

    const summary = {
      folderResults: { total: 0, succeeded: 0, failed: 0 },
      fetchAssetPages: { total: 0, succeeded: 0, failed: 0 },
      fetchAssets: { total: 0, succeeded: 0, failed: 0 },
      save: { total: 0, succeeded: 0, failed: 0 },
    };

    try {
      const folderProgress = ui.createProgressBar({ title: 'Folders...'.padEnd(25) });
      const fetchAssetPagesProgress = ui.createProgressBar({ title: 'Fetching Asset Pages...'.padEnd(24) });
      const fetchAssetsProgress = ui.createProgressBar({ title: 'Fetching Assets...'.padEnd(24) });
      const saveProgress = ui.createProgressBar({ title: 'Saving Assets...'.padEnd(24) });
      await pipeline(
        fetchAssetFoldersStream({
          spaceId: space,
          token: password,
          region,
          setTotalFolders: (total) => {
            summary.folderResults.total = total;
            folderProgress.setTotal(total);
          },
          onSuccess: () => {
            logger.info('Fetched asset folders');
          },
          onError: (error) => {
            logger.error('Error fetching asset folders');
            summary.folderResults.failed += 1;
            summary.folderResults.total = summary.folderResults.total || 1;
            folderProgress.setTotal(summary.folderResults.total);
            handleError(error);
          },
        }),
        writeAssetFolderStream({
          transport: options.dryRun
            ? { write: async folder => folder }
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
            logger.error('Error saving folder', { folderId: folder.id });
            summary.folderResults.failed += 1;
            summary.folderResults.total = Math.max(summary.folderResults.total, summary.folderResults.succeeded + summary.folderResults.failed);
            handleError(error);
          },
        }),
      );
      await pipeline(
        fetchAssetsStream({
          spaceId: space,
          params: {
            filter_query: options.query,
          },
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
            logger.error(`Error fetching page ${page} of ${totalPages}`);
            summary.fetchAssetPages.failed += 1;
            handleError(error);
          },
        }),
        downloadAssetStream({
          onIncrement: () => {
            fetchAssetsProgress.increment();
          },
          onAssetSuccess: (asset) => {
            logger.info('Fetched asset', { assetId: asset.id });
            summary.fetchAssets.succeeded += 1;
          },
          onAssetError: (error, asset) => {
            logger.error('Error fetching asset', { assetId: asset.id });
            summary.fetchAssets.failed += 1;
            summary.save.total -= 1;
            saveProgress.setTotal(summary.save.total);
            handleError(error);
          },
        }),
        writeAssetStream({
          transport: options.dryRun
            ? { write: async asset => asset }
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
            logger.error('Error saving asset', { assetId: asset.id });
            summary.save.failed += 1;
            handleError(error);
          },
        }),
      );
    }
    catch (maybeError) {
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
    }
  });
