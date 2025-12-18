import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { colorPalette, commands, directories } from '../../../constants';
import { assetsCommand } from '../command';
import { getProgram } from '../../../program';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { session } from '../../../session';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, toError } from '../../../utils/error/error';
import { mapiClient } from '../../../api';
import { resolveCommandPath } from '../../../utils/filesystem';
import {
  createAssetFolderStream,
  makeAppendAssetFolderManifestFSTransport,
  makeAppendAssetManifestFSTransport,
  makeCreateAssetAPITransport,
  makeCreateAssetFolderAPITransport,
  makeUpdateAssetAPITransport,
  readLocalAssetFoldersStream,
  readLocalAssetsStream,
  upsertAssetStream,
} from '../streams';
import { loadManifest } from './actions';
import type { Asset } from '../types';

assetsCommand
  .command('push')
  .option('-f, --from <from>', 'source space id')
  .option('-p, --path <path>', 'base path for assets (default .storyblok)')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .description(`Push local assets to a Storyblok space.`)
  .action(async (options) => {
    const program = getProgram();
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();

    ui.title(`${commands.ASSETS}`, colorPalette.ASSETS, 'Pushing assets...');
    logger.info('Pushing assets started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space } = assetsCommand.opts();
    const basePath = options.path as string | undefined;
    const fromSpace = (options.from as string | undefined) || space;
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
      assetResults: { total: 0, succeeded: 0, failed: 0 },
    };

    const manifestFile = join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
    const folderManifestFile = join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
    const manifest = await loadManifest(manifestFile);
    const folderManifest = await loadManifest(folderManifestFile);
    const maps = {
      assets: new Map<number, number>(manifest.map(entry => [Number(entry.old_id), Number(entry.new_id)])),
      assetFolders: new Map<number, number>(folderManifest.map(entry => [Number(entry.old_id), Number(entry.new_id)])),
    };

    try {
      const folderProgress = ui.createProgressBar({ title: 'Folders...'.padEnd(12) });
      const assetProgress = ui.createProgressBar({ title: 'Assets...'.padEnd(12) });

      const assetsDirectoryPath = resolveCommandPath(directories.assets, fromSpace, basePath);

      await pipeline(
        readLocalAssetFoldersStream({
          directoryPath: assetsDirectoryPath,
          setTotalFolders: (total) => {
            summary.folderResults.total = total;
            folderProgress.setTotal(total);
          },
          onFolderError: (error) => {
            handleError(error);
            summary.folderResults.failed += 1;
          },
        }),
        createAssetFolderStream({
          transport: makeCreateAssetFolderAPITransport({
            spaceId: space,
            token: password,
            region,
            maps,
          }),
          manifestTransport: options.dryRun
            ? { append: () => Promise.resolve() }
            : makeAppendAssetFolderManifestFSTransport({ manifestFile: folderManifestFile }),
          onIncrement: () => folderProgress.increment(),
          onFolderSuccess: (localFolder, remoteFolder) => {
            maps.assetFolders.set(localFolder.id, remoteFolder.id);
            summary.folderResults.succeeded += 1;
            logger.info('Created asset folder', { folderId: remoteFolder.id });
            maps.assetFolders.set(localFolder.id, remoteFolder.id);
          },
          onFolderError: (error) => {
            summary.folderResults.failed += 1;
            handleError(error);
          },
        }),
      );

      await pipeline(
        readLocalAssetsStream({
          directoryPath: assetsDirectoryPath,
          setTotalAssets: (total) => {
            summary.assetResults.total = total;
            assetProgress.setTotal(total);
          },
          onAssetError: (error) => {
            handleError(error);
            summary.assetResults.failed += 1;
          },
        }),
        upsertAssetStream({
          createTransport: options.dryRun
            ? { create: async asset => asset }
            : makeCreateAssetAPITransport({ spaceId: space }),
          updateTransport: options.dryRun
            ? { update: async asset => asset }
            : makeUpdateAssetAPITransport({ spaceId: space }),
          manifestTransport: options.dryRun
            ? { append: () => Promise.resolve() }
            : makeAppendAssetManifestFSTransport({ manifestFile }),
          maps,
          spaceId: space,
          onIncrement: () => assetProgress.increment(),
          onAssetSuccess: (localAsset, remoteAsset) => {
            maps.assets.set(localAsset.id, remoteAsset.id);
            summary.assetResults.succeeded += 1;
            logger.info('Uploaded asset', { assetId: remoteAsset.id });
          },
          onAssetError: (error) => {
            summary.assetResults.failed += 1;
            handleError(error);
          },
        }),
      );
    }
    catch (maybeError) {
      handleError(toError(maybeError));
    }
    finally {
      ui.stopAllProgressBars();
      logger.info('Pushing assets finished', summary);
      const pushedLabel = summary.assetResults.total === 1 ? 'asset' : 'assets';
      const failedLabel = summary.assetResults.failed === 1 ? 'asset' : 'assets';
      ui.info(`Push results: ${summary.assetResults.total} ${pushedLabel} pushed, ${summary.assetResults.failed} ${failedLabel} failed`);
      ui.list([
        `Folders: ${summary.folderResults.succeeded}/${summary.folderResults.total} succeeded, ${summary.folderResults.failed} failed.`,
        `Assets: ${summary.assetResults.succeeded}/${summary.assetResults.total} succeeded, ${summary.assetResults.failed} failed.`,
      ]);

      reporter.addSummary('folderResults', summary.folderResults);
      reporter.addSummary('assetResults', summary.assetResults);
      reporter.finalize();
    }
  });
