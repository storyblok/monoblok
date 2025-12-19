import { basename, join } from 'node:path';
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
  makeAppendAssetFolderManifestFSTransport,
  makeAppendAssetManifestFSTransport,
  makeCreateAssetAPITransport,
  makeCreateAssetFolderAPITransport,
  makeUpdateAssetAPITransport,
  makeUpdateAssetFolderAPITransport,
  readLocalAssetFoldersStream,
  readLocalAssetsStream,
  readSingleAssetStream,
  upsertAssetFolderStream,
  upsertAssetStream,
} from '../streams';
import { loadManifest } from './actions';
import type { Asset, AssetCreate, AssetUpdate, AssetUpload } from '../types';
import { isRemoteSource, parseAssetData } from '../utils';

assetsCommand
  .command('push')
  .argument('[asset]', 'path or URL of a single asset to push')
  .option('-f, --from <from>', 'source space id')
  .option('-p, --path <path>', 'base path for assets (default .storyblok)')
  .option('--data <data>', 'inline asset data as JSON')
  .option('--filename <filename>', 'override the asset filename')
  .option('--folder <folderId>', 'destination asset folder ID')
  .option('--cleanup', 'delete local assets and metadata after a successful push')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .description(`Push local assets to a Storyblok space.`)
  .action(async (assetInput, options) => {
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

    try {
      const manifestFile = join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
      const folderManifestFile = join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
      const manifest = await loadManifest(manifestFile);
      if (manifest.length === 0) {
        logger.info('No existing manifest found');
      }
      const folderManifest = await loadManifest(folderManifestFile);
      if (folderManifest.length === 0) {
        logger.info('No existing manifest found');
      }
      const maps = {
        assets: new Map<number, number>(manifest.map(entry => [Number(entry.old_id), Number(entry.new_id)])),
        assetFolders: new Map<number, number>(folderManifest.map(entry => [Number(entry.old_id), Number(entry.new_id)])),
      };

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
            summary.folderResults.failed += 1;
            handleError(error, verbose);
          },
        }),
        upsertAssetFolderStream({
          createTransport: options.dryRun
            ? { create: async folder => folder }
            : makeCreateAssetFolderAPITransport({
                spaceId: space,
                token: password,
                region,
              }),
          updateTransport: options.dryRun
            ? { update: async folder => folder }
            : makeUpdateAssetFolderAPITransport({
                spaceId: space,
                token: password,
                region,
              }),
          spaceId: space,
          token: password,
          region,
          maps,
          manifestTransport: options.dryRun
            ? { append: () => Promise.resolve() }
            : makeAppendAssetFolderManifestFSTransport({ manifestFile: folderManifestFile }),
          onIncrement: () => folderProgress.increment(),
          onFolderSuccess: (localFolder, remoteFolder) => {
            summary.folderResults.succeeded += 1;
            maps.assetFolders.set(localFolder.id, remoteFolder.id);
            logger.info('Created asset folder', { folderId: remoteFolder.id });
          },
          onFolderError: (error, folder) => {
            summary.folderResults.failed += 1;
            handleError(error, verbose, { folderId: folder.id });
          },
        }),
      );

      const steps = [];
      const assetSource = typeof assetInput === 'string' && assetInput.trim().length > 0
        ? assetInput
        : undefined;
      if (assetSource) {
        summary.assetResults.total = 1;
        assetProgress.setTotal(1);

        const assetData = parseAssetData(options.data);
        const sourceBasename = isRemoteSource(assetSource)
          ? basename(new URL(assetSource).pathname)
          : basename(assetSource);
        const shortFilename = options.filename || assetData.short_filename || sourceBasename;
        const folderId = options.folder ? Number(options.folder) : undefined;
        const assetUpload: AssetUpload = {
          ...assetData,
          short_filename: shortFilename,
          asset_folder_id: folderId,
        };

        steps.push(readSingleAssetStream({
          asset: assetUpload,
          assetSource,
          onAssetError: (error) => {
            summary.assetResults.failed += 1;
            assetProgress.increment();
            handleError(error, verbose);
          },
        }));
      }
      else {
        steps.push(readLocalAssetsStream({
          directoryPath: assetsDirectoryPath,
          setTotalAssets: (total) => {
            summary.assetResults.total = total;
            assetProgress.setTotal(total);
          },
          onAssetError: (error) => {
            summary.assetResults.failed += 1;
            assetProgress.increment();
            handleError(error, verbose);
          },
        }));
      }

      const createTransport = options.dryRun
        ? { create: async (asset: AssetCreate) => asset as Asset }
        : makeCreateAssetAPITransport({ spaceId: space });
      const updateTransport = options.dryRun
        ? { update: async (asset: AssetUpdate) => asset as Asset }
        : makeUpdateAssetAPITransport({ spaceId: space });

      steps.push(upsertAssetStream({
        createTransport,
        updateTransport,
        manifestTransport: options.dryRun
          ? { append: () => Promise.resolve() }
          : makeAppendAssetManifestFSTransport({ manifestFile }),
        maps,
        spaceId: space,
        cleanup: options.cleanup && !options.dryRun,
        onIncrement: () => assetProgress.increment(),
        onAssetSuccess: (localAssetResult, remoteAsset) => {
          if (localAssetResult.id) {
            maps.assets.set(localAssetResult.id, remoteAsset.id);
          }
          summary.assetResults.succeeded += 1;
          logger.info('Uploaded asset', { assetId: remoteAsset.id });
        },
        onAssetError: (error, asset) => {
          summary.assetResults.failed += 1;
          handleError(error, verbose, { assetId: asset.id });
        },
      }));
      await pipeline(steps);
    }
    catch (maybeError) {
      handleError(toError(maybeError), verbose);
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
