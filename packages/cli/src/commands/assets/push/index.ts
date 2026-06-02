import { basename, join } from 'pathe';
import { colorPalette, commands, directories } from '../../../constants';
import { assetsCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter, type Report } from '../../../lib/reporter/reporter';
import { session } from '../../../session';
import { requireAuthentication } from '../../../utils/auth';
import { CommandError } from '../../../utils/error/command-error';
import { handleError, toError } from '../../../utils/error/error';
import { deduplicateManifest, resolveCommandPath } from '../../../utils/filesystem';
import {
  makeAppendAssetFolderManifestFSTransport,
  makeAppendAssetManifestFSTransport,
  makeCleanupAssetFolderFSTransport,
  makeCleanupAssetFSTransport,
  makeCreateAssetAPITransport,
  makeCreateAssetFolderAPITransport,
  makeCreateSharedAssetAPITransport,
  makeCreateSharedAssetFolderAPITransport,
  makeGetAssetAPITransport,
  makeGetAssetFolderAPITransport,
  makeGetSharedAssetAPITransport,
  makeGetSharedAssetFolderAPITransport,
  makeSharedTagRemapper,
  makeUpdateAssetAPITransport,
  makeUpdateAssetFolderAPITransport,
  makeUpdateSharedAssetAPITransport,
  makeUpdateSharedAssetFolderAPITransport,
} from '../streams';
import { createAssetInternalTag, fetchAssetInternalTagsByName } from '../actions';
import type { Asset, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetMap, AssetMapped, AssetUpload, UnmappedAssetInternalTag } from '../types';
import { collectAssetInternalTagNames, ensureAssetInternalTags, internalTagNamesFromAssets, isRemoteSource, loadAssetFolderMap, loadAssetMap, loadSidecarAssetData, parseAssetData } from '../utils';
import { findComponentSchemas } from '../../stories/utils';
import { mapAssetReferencesInStoriesPipeline, upsertAssetFoldersPipeline, upsertAssetsPipeline } from '../pipelines';
import type { Story } from '../../stories/constants';
import { makeWriteStoryAPITransport } from '../../stories/streams';
import { assertLibraryWritable, listWritableLibraries, resolveScopeBaseDir, type Scope } from '../scope';

type Summaries = [string, Report['summary'][string]][];

interface ScopeTransports {
  getAsset: ReturnType<typeof makeGetAssetAPITransport>;
  createAsset: ReturnType<typeof makeCreateAssetAPITransport>;
  updateAsset: ReturnType<typeof makeUpdateAssetAPITransport>;
  getAssetFolder: ReturnType<typeof makeGetAssetFolderAPITransport>;
  createAssetFolder: ReturnType<typeof makeCreateAssetFolderAPITransport>;
  updateAssetFolder: ReturnType<typeof makeUpdateAssetFolderAPITransport>;
}

/** Builds the API transport set for a scope. `apiSpace` is the active space. */
function buildScopeTransports(scope: Scope, apiSpace: string): ScopeTransports {
  if (scope.kind === 'library') {
    return {
      getAsset: makeGetSharedAssetAPITransport({ spaceId: apiSpace }),
      createAsset: makeCreateSharedAssetAPITransport({ spaceId: apiSpace }),
      updateAsset: makeUpdateSharedAssetAPITransport({ spaceId: apiSpace }),
      getAssetFolder: makeGetSharedAssetFolderAPITransport({ spaceId: apiSpace }),
      createAssetFolder: makeCreateSharedAssetFolderAPITransport({ spaceId: apiSpace }),
      updateAssetFolder: makeUpdateSharedAssetFolderAPITransport({ spaceId: apiSpace }),
    };
  }
  return {
    getAsset: makeGetAssetAPITransport({ spaceId: apiSpace }),
    createAsset: makeCreateAssetAPITransport({ spaceId: apiSpace }),
    updateAsset: makeUpdateAssetAPITransport({ spaceId: apiSpace }),
    getAssetFolder: makeGetAssetFolderAPITransport({ spaceId: apiSpace }),
    createAssetFolder: makeCreateAssetFolderAPITransport({ spaceId: apiSpace }),
    updateAssetFolder: makeUpdateAssetFolderAPITransport({ spaceId: apiSpace }),
  };
}

const pushCmd = assetsCommand
  .command('push')
  .argument('[asset]', 'path or URL of a single asset to push')
  .option('-s, --space <space>', 'space ID')
  .option('-f, --from <from>', 'source space id')
  .option('--data <data>', 'inline asset data as JSON')
  .option('--short-filename <short-filename>', 'override the asset filename')
  .option('--folder <folderId>', 'destination asset folder ID')
  .option('--target <target>', 'push destination: space | shared | all', 'space')
  .option('--library <libraryId>', 'destination library ID (required for single-asset --target=shared)')
  .option('--cleanup', 'delete local assets and metadata after a successful push (note: does not cleanup manifests)')
  .option('--update-stories', 'update file references in stories if necessary', false)
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .description(`Push local assets to a Storyblok space or shared library.`);

pushCmd
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
    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      process.exitCode = 2;
      return;
    }
    if (!targetSpace) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      process.exitCode = 2;
      return;
    }

    const target = (options.target as string) ?? 'space';
    const libraryId = options.library ? Number(options.library) : undefined;
    const assetBinaryPath = typeof assetInput === 'string' && assetInput.trim().length > 0
      ? assetInput
      : undefined;

    // Validate the target/library combination for single-asset pushes.
    if (assetBinaryPath) {
      if (target === 'shared' && !libraryId) {
        handleError(new CommandError('Pushing a single asset to a library requires --library YOUR_LIBRARY_ID.'), verbose);
        process.exitCode = 2;
        return;
      }
      if (target === 'space' && libraryId) {
        handleError(new CommandError('--library cannot be combined with --target=space.'), verbose);
        process.exitCode = 2;
        return;
      }
    }

    // Resolve the list of scopes to process, then fail fast on read-only
    // libraries before any writes happen.
    let scopes: Scope[] = [];
    try {
      if (assetBinaryPath) {
        scopes = target === 'shared'
          ? [{ kind: 'library', libraryId: libraryId! }]
          : [{ kind: 'space', spaceId: Number(fromSpace) }];
      }
      else {
        if (target === 'space' || target === 'all') {
          scopes.push({ kind: 'space', spaceId: Number(fromSpace) });
        }
        if (target === 'shared' || target === 'all') {
          const libraries = await listWritableLibraries(targetSpace);
          scopes.push(...libraries.map(library => ({ kind: 'library', libraryId: library.id }) satisfies Scope));
        }
      }
      for (const scope of scopes) {
        if (scope.kind === 'library') {
          await assertLibraryWritable(targetSpace, scope.libraryId);
        }
      }
    }
    catch (maybeError) {
      handleError(toError(maybeError), verbose);
      process.exitCode = 2;
      return;
    }

    const summaries: Summaries = [];
    let fatalError = false;
    let spaceAssetMap: AssetMap | undefined;
    let spaceManifestFile: string | undefined;

    // Prepare single-asset upload data once (shared by whichever scope runs it).
    let assetData: AssetUpload | undefined;
    if (assetBinaryPath) {
      const assetDataPartial = options.data
        ? parseAssetData(options.data)
        : !isRemoteSource(assetBinaryPath)
            ? await loadSidecarAssetData(assetBinaryPath)
            : {};
      const sourceBasename = isRemoteSource(assetBinaryPath)
        ? basename(new URL(assetBinaryPath).pathname)
        : basename(assetBinaryPath);
      const shortFilename = options.shortFilename || assetDataPartial.short_filename || sourceBasename;
      const folderId = options.folder ? Number(options.folder) : undefined;
      assetData = {
        ...assetDataPartial,
        short_filename: shortFilename,
        asset_folder_id: folderId,
      } satisfies AssetUpload;
    }

    try {
      for (const scope of scopes) {
        const assetsDirectoryPath = resolveScopeBaseDir(scope, basePath);
        const manifestFile = join(assetsDirectoryPath, 'manifest.jsonl');
        const folderManifestFile = join(assetsDirectoryPath, 'folders', 'manifest.jsonl');
        const transports = buildScopeTransports(scope, targetSpace);

        const [assetMap, assetFolderMap] = await Promise.all([
          loadAssetMap(manifestFile),
          loadAssetFolderMap(folderManifestFile),
        ]);
        const maps = { assets: assetMap, assetFolders: assetFolderMap };
        if (scope.kind === 'space') {
          spaceAssetMap = maps.assets;
          spaceManifestFile = manifestFile;
        }

        /**
         * Upsert Asset Folders (skipped for single-asset pushes).
         */
        if (!assetBinaryPath) {
          const assetFolderCreateTransport = options.dryRun
            ? async (folder: AssetFolderCreate) => folder as AssetFolder
            : transports.createAssetFolder;
          const assetFolderUpdateTransport = options.dryRun
            ? async (_id: number, folder: AssetFolderUpdate) => folder
            : transports.updateAssetFolder;
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
              getAssetFolder: transports.getAssetFolder,
              createAssetFolder: assetFolderCreateTransport,
              updateAssetFolder: assetFolderUpdateTransport,
              appendAssetFolderManifest: assetFolderManifestTransport,
              cleanupAssetFolder: cleanupAssetFolderTransport,
            },
            ui,
          }));
        }

        /**
         * Upsert Assets
         */
        // For library pushes, remap local tag IDs to the library's shared tags
        // (creating missing ones) and default the asset folder to the library
        // root before uploading. Shared-asset creation requires an
        // `asset_folder_id` the space can write to, so a missing one (single
        // asset without --folder, or a sidecar that omits it) would 403.
        const baseCreateAsset = scope.kind === 'library' && !options.dryRun
          ? (() => {
              const { libraryId } = scope;
              const remapTags = makeSharedTagRemapper({ spaceId: targetSpace, libraryId });
              return async (asset: AssetUpload, fileBuffer: ArrayBuffer) => {
                const withFolder = asset.asset_folder_id == null
                  ? { ...asset, asset_folder_id: libraryId }
                  : asset;
                return transports.createAsset(await remapTags(withFolder), fileBuffer);
              };
            })()
          : transports.createAsset;
        const createAssetTransport = options.dryRun
          ? async (asset: AssetUpload) => asset as Asset
          : baseCreateAsset;
        const updateAssetTransport = options.dryRun
          ? async () => {}
          : transports.updateAsset;
        const assetManifestTransport = options.dryRun
          ? () => Promise.resolve()
          : makeAppendAssetManifestFSTransport({ manifestFile });
        const cleanupAssetTransport = options.cleanup && !options.dryRun
          ? makeCleanupAssetFSTransport()
          : () => Promise.resolve();

        // Only build the target-space tag map for cross-space pushes; same-space
        // pushes keep their IDs as-is. A failed fetch throws and aborts the push:
        // fail fast rather than push unmappable IDs. Space scope only; libraries
        // remap to their own shared tags.
        let assetInternalTagsByName = scope.kind === 'space' && fromSpace !== targetSpace
          ? await fetchAssetInternalTagsByName(targetSpace)
          : undefined;

        // Pre-create source tag names missing from the target space so pushed
        // assets keep their tags instead of having the references dropped. Skipped
        // on dry runs (no writes); creation is best-effort, a failed create leaves
        // the name unmapped and the reference is dropped with the warning below.
        if (assetInternalTagsByName && !options.dryRun) {
          const sourceTagNames = assetBinaryPath
            ? internalTagNamesFromAssets(assetData ? [assetData] : [])
            : await collectAssetInternalTagNames(assetsDirectoryPath);
          const createdTagLabels: string[] = [];
          assetInternalTagsByName = await ensureAssetInternalTags({
            sourceTagNames,
            targetTagsByName: assetInternalTagsByName,
            createTag: name => createAssetInternalTag(targetSpace, name),
            onTagCreated: name => createdTagLabels.push(name),
            onTagCreateError: (name, error) =>
              logger.warn(`Failed to create internal asset tag "${name}"`, { error: error.message }),
          });
          if (createdTagLabels.length > 0) {
            const labels = [...createdTagLabels].sort((a, b) => a.localeCompare(b));
            const message = `Created ${labels.length} internal asset tag${labels.length === 1 ? '' : 's'} in target space: ${labels.join(', ')}`;
            ui.info(message);
            logger.info(message, { createdTags: labels });
          }
        }

        const unmappedTagLabels = new Set<string>();
        const onUnmappedTag = ({ sourceId, name }: UnmappedAssetInternalTag) => {
          unmappedTagLabels.add(name ?? `#${sourceId}`);
        };

        summaries.push(...await upsertAssetsPipeline({
          assetBinaryPath,
          assetData,
          directoryPath: assetsDirectoryPath,
          logger,
          maps: { ...maps, assetInternalTagsByName },
          transports: {
            getAsset: transports.getAsset,
            createAsset: createAssetTransport,
            updateAsset: updateAssetTransport,
            appendAssetManifest: assetManifestTransport,
            cleanupAsset: cleanupAssetTransport,
          },
          ui,
          onUnmappedTag,
        }));

        if (unmappedTagLabels.size > 0) {
          const labels = [...unmappedTagLabels].sort((a, b) => a.localeCompare(b));
          const message = `Dropped ${labels.length} unknown internal asset tag${labels.length === 1 ? '' : 's'} not present in target space: ${labels.join(', ')}`;
          ui.warn(message);
          logger.warn(message, { unmappedTags: labels });
        }
      }

      /**
       * Map Asset References in Stories (space scope only).
       */
      if (spaceAssetMap) {
        const hasUpdatedFilename = (entry: { old: Asset | AssetMapped | AssetUpload; new: AssetMapped }) =>
          'filename' in entry.old && entry.old.filename !== entry.new.filename;
        const hasMetadata = (entry: { old: Asset | AssetMapped | AssetUpload; new: AssetMapped }) =>
          'meta_data' in entry.new && entry.new.meta_data;
        const hasUpdatedAssets = spaceAssetMap.values().some(v => hasUpdatedFilename(v) || hasMetadata(v));
        if (hasUpdatedAssets && options.updateStories) {
          const schemas = await findComponentSchemas(resolveCommandPath(directories.components, fromSpace, basePath));
          const writeStoryTransport = options.dryRun
            ? async (story: Story) => story
            : makeWriteStoryAPITransport({ spaceId: targetSpace });

          summaries.push(...await mapAssetReferencesInStoriesPipeline({
            logger,
            maps: { assets: spaceAssetMap },
            schemas,
            space: targetSpace,
            transports: {
              writeStory: writeStoryTransport,
            },
            ui,
          }));
        }
      }

      if (!options.dryRun && spaceManifestFile) {
        await deduplicateManifest(spaceManifestFile);
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
      const assetsFailed = summary.assetResults?.failed ?? 0;

      ui.info(`Push results: ${assetsTotal} processed, ${assetsFailed} assets failed`);
      ui.list([
        `Folders: ${summary.assetFolderResults?.succeeded ?? 0}/${summary.assetFolderResults?.total ?? 0} succeeded, ${summary.assetFolderResults?.failed ?? 0} failed.`,
        `Assets: ${assetsSucceeded}/${assetsTotal} succeeded, ${assetsFailed} failed.`,
      ]);
      for (const [name, reportSummary] of summaries) {
        reporter.addSummary(name, reportSummary);
      }
      reporter.finalize();

      // Sum across the raw summaries array (not the deduped object): multiple
      // scopes can emit the same summary key, and each scope's failures count.
      const failedTotal = summaries.reduce((total, [, entry]) => {
        if (!entry || typeof entry.failed !== 'number') {
          return total;
        }
        return total + entry.failed;
      }, 0);
      process.exitCode = fatalError ? 2 : failedTotal > 0 ? 1 : 0;
    }
  });
