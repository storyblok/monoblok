import { basename, join } from 'node:path';
import { colorPalette, commands, directories } from '../../../constants';
import { assetsCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter, type Report } from '../../../lib/reporter/reporter';
import { session } from '../../../session';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, toError } from '../../../utils/error/error';
import { mapiClient } from '../../../api';
import { deduplicateManifest, resolveCommandPath } from '../../../utils/filesystem';
import {
  makeAppendAssetFolderManifestFSTransport,
  makeAppendAssetManifestFSTransport,
  makeCleanupAssetFolderFSTransport,
  makeCleanupAssetFSTransport,
  makeCreateAssetAPITransport,
  makeCreateAssetFolderAPITransport,
  makeDownloadAssetFileTransport,
  makeGetAssetAPITransport,
  makeGetAssetFolderAPITransport,
  makeUpdateAssetAPITransport,
  makeUpdateAssetFolderAPITransport,
} from '../streams';
import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetMapped, AssetUpdate, AssetUpload } from '../types';
import { isRemoteSource, loadAssetFolderMap, loadAssetMap, loadSidecarAssetData, parseAssetData } from '../utils';
import { findComponentSchemas } from '../../stories/utils';
import { mapAssetReferencesInStoriesPipeline, upsertAssetFoldersPipeline, upsertAssetsPipeline } from '../pipelines';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { makeWriteStoryAPITransport } from '../../stories/streams';

assetsCommand
  .command('push')
  .argument('[asset]', 'path or URL of a single asset to push')
  .option('-f, --from <from>', 'source space id')
  .option('--data <data>', 'inline asset data as JSON')
  .option('--short-filename <short-filename>', 'override the asset filename')
  .option('--folder <folderId>', 'destination asset folder ID')
  .option('--cleanup', 'delete local assets and metadata after a successful push')
  .option('--update-stories', 'update file references in stories if necessary', false)
  .option('--asset-token <token>', 'asset token for accessing private assets')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .description(`Push local assets to a Storyblok space.`)
  .action(async (assetInput, options, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();

    ui.title(`${commands.ASSETS}`, colorPalette.ASSETS, 'Pushing assets...');
    logger.info('Pushing assets started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space: targetSpace, path: basePath, verbose } = command.optsWithGlobals();
    const fromSpace = (options.from as string | undefined) || targetSpace;
    const assetToken = options.assetToken as string | undefined;
    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      process.exitCode = 2;
      return;
    }
    if (!targetSpace) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      process.exitCode = 2;
      return;
    }

    const { password, region } = state;

    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    const summaries: [string, Report['summary'][string]][] = [];
    let fatalError = false;

    const manifestFile = join(resolveCommandPath(directories.assets, fromSpace, basePath), 'manifest.jsonl');
    const folderManifestFile = join(resolveCommandPath(directories.assets, fromSpace, basePath), 'folders', 'manifest.jsonl');

    try {
      const [assetMap, assetFolderMap] = await Promise.all([
        loadAssetMap(manifestFile),
        loadAssetFolderMap(folderManifestFile),
      ]);
      const maps = { assets: assetMap, assetFolders: assetFolderMap };
      const assetsDirectoryPath = resolveCommandPath(directories.assets, fromSpace, basePath);

      /**
       * Upsert Asset Folders
       */
      const assetFolderGetTransport = makeGetAssetFolderAPITransport({ spaceId: targetSpace });
      const assetFolderCreateTransport = options.dryRun
        ? async (folder: AssetFolderCreate) => folder as AssetFolder
        : makeCreateAssetFolderAPITransport({ spaceId: targetSpace });
      const assetFolderUpdateTransport = options.dryRun
        ? async (folder: AssetFolderUpdate) => folder
        : makeUpdateAssetFolderAPITransport({ spaceId: targetSpace });
      const assetFolderManifestTransport = options.dryRun
        ? () => Promise.resolve()
        : makeAppendAssetFolderManifestFSTransport({ manifestFile: folderManifestFile });
      const cleanupAssetFolderTransport = options.cleanup && !options.dryRun
        ? makeCleanupAssetFolderFSTransport()
        : () => Promise.resolve();

      summaries.push(...await upsertAssetFoldersPipeline({
        directoryPath: join(assetsDirectoryPath, 'folders'),
        logger,
        maps,
        transports: {
          getAssetFolder: assetFolderGetTransport,
          createAssetFolder: assetFolderCreateTransport,
          updateAssetFolder: assetFolderUpdateTransport,
          appendAssetFolderManifest: assetFolderManifestTransport,
          cleanupAssetFolder: cleanupAssetFolderTransport,
        },
        ui,
      }));

      /**
       * Upsert Assets
       */
      const assetSource = typeof assetInput === 'string' && assetInput.trim().length > 0
        ? assetInput
        : undefined;
      let assetData: AssetUpload | undefined;
      if (assetSource) {
        const assetDataPartial = options.data
          ? parseAssetData(options.data)
          : !isRemoteSource(assetSource)
              ? await loadSidecarAssetData(assetSource)
              : {};
        const sourceBasename = isRemoteSource(assetSource)
          ? basename(new URL(assetSource).pathname)
          : basename(assetSource);
        const shortFilename = options.shortFilename || assetDataPartial.short_filename || sourceBasename;
        const folderId = options.folder ? Number(options.folder) : undefined;
        assetData = {
          ...assetDataPartial,
          short_filename: shortFilename,
          asset_folder_id: folderId,
        } satisfies AssetUpload;
      }

      const getAssetTransport = makeGetAssetAPITransport({ spaceId: targetSpace });
      const createAssetTransport = options.dryRun
        ? async (asset: AssetCreate) => asset as Asset
        : makeCreateAssetAPITransport({ spaceId: targetSpace });
      const updateAssetTransport = options.dryRun
        ? async (asset: AssetUpdate) => asset as Asset
        : makeUpdateAssetAPITransport({ spaceId: targetSpace });
      const downloadAssetFileTransport = makeDownloadAssetFileTransport({
        assetToken,
        region,
      });
      const assetManifestTransport = options.dryRun
        ? () => Promise.resolve()
        : makeAppendAssetManifestFSTransport({ manifestFile });
      const cleanupAssetTransport = options.cleanup && !options.dryRun
        ? makeCleanupAssetFSTransport()
        : () => Promise.resolve();

      summaries.push(...await upsertAssetsPipeline({
        assetSource,
        assetData,
        directoryPath: assetsDirectoryPath,
        logger,
        maps,
        transports: {
          getAsset: getAssetTransport,
          createAsset: createAssetTransport,
          updateAsset: updateAssetTransport,
          downloadAssetFile: downloadAssetFileTransport,
          appendAssetManifest: assetManifestTransport,
          cleanupAsset: cleanupAssetTransport,
        },
        ui,
      }));

      /**
       * Map Asset References in Stories
       */
      const hasUpdatedFilename = (entry: { old: Asset | AssetUpload; new: AssetMapped }) =>
        'filename' in entry.old && entry.old.filename !== entry.new.filename;
      const hasMetadata = (entry: { old: Asset | AssetUpload; new: AssetMapped }) =>
        'meta_data' in entry.new && entry.new.meta_data;
      const hasUpdatedAssets = maps.assets.values().some(v => hasUpdatedFilename(v) || hasMetadata(v));
      if (hasUpdatedAssets && options.updateStories) {
        const schemas = await findComponentSchemas(resolveCommandPath(directories.components, fromSpace, basePath));
        const writeStoryTransport = options.dryRun
          ? async (story: Story) => story
          : makeWriteStoryAPITransport({ spaceId: targetSpace });

        summaries.push(...await mapAssetReferencesInStoriesPipeline({
          logger,
          maps,
          schemas,
          space: targetSpace,
          transports: {
            writeStory: writeStoryTransport,
          },
          ui,
        }));
      }

      if (!options.dryRun) {
        await deduplicateManifest(manifestFile);
      }
    }
    catch (maybeError) {
      fatalError = true;
      handleError(toError(maybeError), verbose);
    }
    finally {
      ui.stopAllProgressBars();

      const summary = Object.fromEntries(summaries);
      logger.info('Pushing assets finished', { summary });
      const assetsTotal = summary.assetResults?.total ?? 0;
      const assetsSucceeded = summary.assetResults?.succeeded ?? 0;
      const assetsSkipped = summary.assetResults?.skipped ?? 0;
      const assetsFailed = summary.assetResults?.failed ?? 0;

      ui.info(`Push results: ${assetsTotal} processed, ${assetsFailed} assets failed`);
      ui.list([
        `Folders: ${summary.assetFolderResults?.succeeded ?? 0}/${summary.assetFolderResults?.total ?? 0} succeeded, ${summary.assetFolderResults?.failed ?? 0} failed.`,
        `Assets: ${assetsSucceeded}/${assetsTotal} succeeded, ${assetsSkipped} skipped, ${assetsFailed} failed.`,
      ]);
      for (const [name, reportSummary] of summaries) {
        reporter.addSummary(name, reportSummary);
      }
      reporter.finalize();

      const failedTotal = Object.values(summary).reduce((total, entry) => {
        if (!entry || typeof entry.failed !== 'number') {
          return total;
        }
        return total + entry.failed;
      }, 0);
      process.exitCode = fatalError ? 2 : failedTotal > 0 ? 1 : 0;
    }
  });
