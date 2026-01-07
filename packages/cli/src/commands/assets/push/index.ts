import { basename, join } from 'node:path';
import { colorPalette, commands, directories } from '../../../constants';
import { assetsCommand } from '../command';
import { getProgram } from '../../../program';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter, type Report } from '../../../lib/reporter/reporter';
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
  makeGetAssetAPITransport,
  makeGetAssetFolderAPITransport,
  makeUpdateAssetAPITransport,
  makeUpdateAssetFolderAPITransport,
} from '../streams';
import { loadManifest } from './actions';
import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetUpdate, AssetUpload } from '../types';
import { isRemoteSource, loadSidecarAssetData, parseAssetData } from '../utils';
import { findComponentSchemas } from '../../stories/utils';
import { mapAssetReferencesInStoriesPipeline, upsertAssetFoldersPipeline, upsertAssetsPipeline } from '../pipelines';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { makeWriteStoryAPITransport } from '../../stories/streams';

assetsCommand
  .command('push')
  .argument('[asset]', 'path or URL of a single asset to push')
  .option('-f, --from <from>', 'source space id')
  .option('-p, --path <path>', 'base path for assets (default .storyblok)')
  .option('--data <data>', 'inline asset data as JSON')
  .option('--filename <filename>', 'override the asset filename')
  .option('--folder <folderId>', 'destination asset folder ID')
  .option('--cleanup', 'delete local assets and metadata after a successful push')
  // TODO false good default?
  .option('--update-stories', 'update file references in stories if necessary', false)
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

    const summaries: [string, Report['summary'][string]][] = [];

    try {
      const manifestFile = join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
      const manifest = await loadManifest(manifestFile);
      if (manifest.length === 0) {
        logger.info('No existing manifest found');
      }
      const folderManifestFile = join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
      const folderManifest = await loadManifest(folderManifestFile);
      if (folderManifest.length === 0) {
        logger.info('No existing manifest found');
      }

      const maps = {
        assets: new Map<number, number>(manifest.map(entry => [Number(entry.old_id), Number(entry.new_id)])),
        assetFolders: new Map<number, number>(folderManifest.map(entry => [Number(entry.old_id), Number(entry.new_id)])),
        stories: new Map(),
      };
      const assetsDirectoryPath = resolveCommandPath(directories.assets, fromSpace, basePath);

      /**
       * Upsert Asset Folders
       */
      const assetFolderGetTransport = makeGetAssetFolderAPITransport({ spaceId: space });
      const assetFolderCreateTransport = options.dryRun
        ? { create: async (folder: AssetFolderCreate) => folder as AssetFolder }
        : makeCreateAssetFolderAPITransport({ spaceId: space });
      const assetFolderUpdateTransport = options.dryRun
        ? { update: async (folder: AssetFolderUpdate) => folder }
        : makeUpdateAssetFolderAPITransport({ spaceId: space });
      const assetFolderManifestTransport = options.dryRun
        ? { append: () => Promise.resolve() }
        : makeAppendAssetFolderManifestFSTransport({ manifestFile: folderManifestFile });

      summaries.push(...await upsertAssetFoldersPipeline({
        directoryPath: join(assetsDirectoryPath, 'folders'),
        logger,
        maps,
        transports: {
          get: assetFolderGetTransport,
          create: assetFolderCreateTransport,
          update: assetFolderUpdateTransport,
          manifest: assetFolderManifestTransport,
        },
        ui,
        verbose,
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
        const shortFilename = options.filename || assetDataPartial.short_filename || sourceBasename;
        const folderId = options.folder ? Number(options.folder) : undefined;
        assetData = {
          ...assetDataPartial,
          short_filename: shortFilename,
          asset_folder_id: folderId,
        } satisfies AssetUpload;
      }

      const getAssetTransport = makeGetAssetAPITransport({ spaceId: space });
      const createAssetTransport = options.dryRun
        ? { create: async (asset: AssetCreate) => asset as Asset }
        : makeCreateAssetAPITransport({ spaceId: space });
      const updateAssetTransport = options.dryRun
        ? { update: async (asset: AssetUpdate) => asset as Asset }
        : makeUpdateAssetAPITransport({ spaceId: space });
      const assetManifestTransport = options.dryRun
        ? { append: () => Promise.resolve() }
        : makeAppendAssetManifestFSTransport({ manifestFile });

      summaries.push(...await upsertAssetsPipeline({
        assetSource,
        assetData,
        cleanup: options.cleanup && !options.dryRun,
        directoryPath: assetsDirectoryPath,
        logger,
        maps,
        transports: {
          get: getAssetTransport,
          create: createAssetTransport,
          update: updateAssetTransport,
          manifest: assetManifestTransport,
        },
        ui,
        verbose,
      }));

      /**
       * Map Asset References in Stories
       */
      // TODO test
      const hasNewFileReferences = maps.assets.entries().some(([k, v]) => k !== v);
      if (hasNewFileReferences && options.updateStories) {
        const schemas = await findComponentSchemas(resolveCommandPath(directories.components, fromSpace, basePath));

        const writeStoryTransport = options.dryRun
          ? { write: async (story: Story) => story }
          // TODO publish if it already was published
          : makeWriteStoryAPITransport({ spaceId: space, publish: false });

        summaries.push(...await mapAssetReferencesInStoriesPipeline({
          logger,
          maps,
          schemas,
          space,
          transports: {
            write: writeStoryTransport,
          },
          ui,
        }));
      }
    }
    catch (maybeError) {
      handleError(toError(maybeError), verbose);
    }
    finally {
      ui.stopAllProgressBars();
      const summary = Object.fromEntries(summaries);
      logger.info('Pushing assets finished', { summary });
      const assetsPushed = summary.assetResults?.total ?? 0;
      const assetsFailed = summary.assetResults?.failed ?? 0;
      const pushedLabel = assetsPushed === 1 ? 'asset' : 'assets';
      const failedLabel = assetsFailed === 1 ? 'asset' : 'assets';
      ui.info(`Push results: ${assetsPushed} ${pushedLabel} pushed, ${assetsFailed} ${failedLabel} failed`);
      ui.list([
        `Folders: ${summary.folderResults?.succeeded ?? 0}/${summary.folderResults?.total ?? 0} succeeded, ${summary.folderResults?.failed ?? 0} failed.`,
        `Assets: ${summary.assetResults?.succeeded ?? 0}/${assetsPushed} succeeded, ${assetsFailed} failed.`,
      ]);
      for (const [name, reportSummary] of summaries) {
        reporter.addSummary(name, reportSummary);
      }
      reporter.finalize();
    }
  });
