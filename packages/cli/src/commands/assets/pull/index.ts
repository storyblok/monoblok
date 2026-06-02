import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Option } from 'commander';
import { Sema } from 'async-sema';
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
  fetchSharedAssetFoldersStream,
  fetchSharedAssetsStream,
  makeWriteAssetFolderFSTransport,
  makeWriteAssetFSTransport,
  writeAssetFolderStream,
  writeAssetStream,
} from '../streams';
import type { Asset } from '../types';
import { getSharedAsset } from '../actions';
import { buildLibraryRootResolver, listReadableLibraries, resolveScopeBaseDir, type Scope } from '../scope';
import { collectReferencedAssetIds, readLocalStoryContents } from '../referenced';

interface PullSummary {
  folderResults: { total: number; succeeded: number; failed: number };
  fetchAssetPages: { total: number; succeeded: number; failed: number };
  fetchAssets: { total: number; succeeded: number; failed: number };
  save: { total: number; succeeded: number; failed: number };
}

const createSummary = (): PullSummary => ({
  folderResults: { total: 0, succeeded: 0, failed: 0 },
  fetchAssetPages: { total: 0, succeeded: 0, failed: 0 },
  fetchAssets: { total: 0, succeeded: 0, failed: 0 },
  save: { total: 0, succeeded: 0, failed: 0 },
});

const pullCmd = assetsCommand
  .command('pull')
  .option('-s, --space <space>', 'space ID')
  .addOption(new Option('--target <target>', 'pull source: with-referenced | all | space | shared').choices(['with-referenced', 'all', 'space', 'shared']).default('with-referenced'))
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('-q, --query <query>', 'Filter assets using Storyblok filter query syntax. Example: --query="search=my-file.jpg&with_tags=tag1,tag2"')
  .option('--asset-token <token>', 'Asset token for accessing private assets')
  .description(`Download your space's assets, and optionally shared library assets, as local files.`);

pullCmd
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
    const target = (options.target as string) ?? 'with-referenced';
    const params = options.query ? Object.fromEntries(new URLSearchParams(options.query)) : {};
    const summary = createSummary();
    let fatalError = false;

    /** Pulls a full scope: its folders and all of its assets. */
    const pullScopeFull = async (scope: Scope): Promise<Set<number>> => {
      const directoryPath = resolveScopeBaseDir(scope, basePath);
      const collectedIds = new Set<number>();

      const folderProgress = ui.createProgressBar({ title: 'Folders...'.padEnd(25) });
      const fetchAssetPagesProgress = ui.createProgressBar({ title: 'Fetching Asset Pages...'.padEnd(24) });
      const fetchAssetsProgress = ui.createProgressBar({ title: 'Fetching Assets...'.padEnd(24) });
      const saveProgress = ui.createProgressBar({ title: 'Saving Assets...'.padEnd(24) });

      const folderHandlers = {
        spaceId: space,
        setTotalFolders: (total: number) => {
          summary.folderResults.total += total;
          folderProgress.setTotal(total);
        },
        onError: (error: Error) => {
          summary.folderResults.failed += 1;
          summary.folderResults.total = summary.folderResults.total || 1;
          folderProgress.setTotal(summary.folderResults.total);
          logOnlyError(error);
        },
      };
      const foldersStream = scope.kind === 'library'
        ? fetchSharedAssetFoldersStream({
            ...folderHandlers,
            libraryId: scope.libraryId,
            onSuccess: () => logger.info('Fetched library folders', { libraryId: scope.libraryId }),
          })
        : fetchAssetFoldersStream({
            ...folderHandlers,
            onSuccess: () => logger.info('Fetched asset folders'),
          });

      await pipeline(
        foldersStream,
        writeAssetFolderStream({
          writeAssetFolder: options.dryRun
            ? async folder => folder
            : makeWriteAssetFolderFSTransport({ directoryPath }),
          onIncrement: () => folderProgress.increment(),
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

      // Capture per-scope bases so repeated setter calls assign (idempotent)
      // within a scope while still accumulating across scopes.
      const pagesBase = summary.fetchAssetPages.total;
      const assetsBase = summary.fetchAssets.total;
      const saveBase = summary.save.total;
      const assetLabel = scope.kind === 'library' ? 'library assets' : 'assets';
      const assetHandlers = {
        spaceId: space,
        params,
        setTotalAssets: (total: number) => {
          summary.fetchAssets.total = assetsBase + total;
          summary.save.total = saveBase + total;
          fetchAssetsProgress.setTotal(total);
          saveProgress.setTotal(total);
        },
        setTotalPages: (totalPages: number) => {
          summary.fetchAssetPages.total = pagesBase + totalPages;
          fetchAssetPagesProgress.setTotal(totalPages);
        },
        onIncrement: () => fetchAssetPagesProgress.increment(),
        onPageSuccess: (page: number, totalPages: number) => {
          logger.info(`Fetched ${assetLabel} page ${page} of ${totalPages}`);
          summary.fetchAssetPages.succeeded += 1;
        },
        onPageError: (error: Error, page: number, totalPages: number) => {
          summary.fetchAssetPages.failed += 1;
          logOnlyError(error, { page, totalPages });
        },
      };
      const assetsStream = scope.kind === 'library'
        ? fetchSharedAssetsStream({ ...assetHandlers, libraryId: scope.libraryId })
        : fetchAssetsStream(assetHandlers);

      await pipeline(
        assetsStream,
        downloadAssetStream({
          assetToken,
          region,
          onIncrement: () => fetchAssetsProgress.increment(),
          onAssetSuccess: (asset) => {
            logger.info('Fetched asset', { assetId: asset.id });
            collectedIds.add(asset.id);
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
            : makeWriteAssetFSTransport({ directoryPath }),
          onIncrement: () => saveProgress.increment(),
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

      return collectedIds;
    };

    /**
     * Pulls a specific set of already-resolved shared assets into their library
     * subtree (used by `with-referenced`): pulls the library folders, then
     * downloads only the referenced assets.
     */
    const pullReferencedAssets = async (libraryId: number, assets: Asset[]): Promise<void> => {
      const scope: Scope = { kind: 'library', libraryId };
      const directoryPath = resolveScopeBaseDir(scope, basePath);

      const folderProgress = ui.createProgressBar({ title: 'Folders...'.padEnd(25) });
      await pipeline(
        fetchSharedAssetFoldersStream({
          spaceId: space,
          libraryId,
          setTotalFolders: total => folderProgress.setTotal(total),
          onError: error => logOnlyError(error),
        }),
        writeAssetFolderStream({
          writeAssetFolder: options.dryRun
            ? async folder => folder
            : makeWriteAssetFolderFSTransport({ directoryPath }),
          onIncrement: () => folderProgress.increment(),
          onFolderSuccess: (folder) => {
            summary.folderResults.total += 1;
            summary.folderResults.succeeded += 1;
            logger.info('Saved library folder', { folderId: folder.id });
          },
          onFolderError: (error, folder) => {
            summary.folderResults.failed += 1;
            logOnlyError(error, { folderId: folder.id });
          },
        }),
      );

      const saveProgress = ui.createProgressBar({ title: 'Saving Assets...'.padEnd(24) });
      summary.fetchAssets.total += assets.length;
      summary.save.total += assets.length;
      saveProgress.setTotal(assets.length);

      await pipeline(
        Readable.from(assets),
        downloadAssetStream({
          assetToken,
          region,
          onAssetSuccess: (asset) => {
            logger.info('Fetched library asset', { assetId: asset.id });
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
            : makeWriteAssetFSTransport({ directoryPath }),
          onIncrement: () => saveProgress.increment(),
          onAssetSuccess: (asset) => {
            logger.info('Saved library asset', { assetId: asset.id });
            summary.save.succeeded += 1;
          },
          onAssetError: (error, asset) => {
            summary.save.failed += 1;
            logOnlyError(error, { assetId: asset.id });
          },
        }),
      );
    };

    try {
      if (target === 'space') {
        await pullScopeFull({ kind: 'space', spaceId: Number(space) });
      }
      else if (target === 'shared') {
        const libraries = await listReadableLibraries(space);
        for (const library of libraries) {
          await pullScopeFull({ kind: 'library', libraryId: library.id });
        }
      }
      else if (target === 'all') {
        await pullScopeFull({ kind: 'space', spaceId: Number(space) });
        const libraries = await listReadableLibraries(space);
        for (const library of libraries) {
          await pullScopeFull({ kind: 'library', libraryId: library.id });
        }
      }
      else {
        // with-referenced (default): pull the space, then resolve shared assets
        // referenced by already-pulled local stories.
        const spaceAssetIds = await pullScopeFull({ kind: 'space', spaceId: Number(space) });

        const stories = await readLocalStoryContents(resolveCommandPath(directories.stories, space, basePath));
        if (stories.length > 0) {
          const referenced = collectReferencedAssetIds(stories);
          for (const id of spaceAssetIds) {
            referenced.delete(id);
          }

          if (referenced.size > 0) {
            const lock = new Sema(12);
            const resolved = await Promise.all(
              [...referenced].map(async (id) => {
                await lock.acquire();
                try {
                  return await getSharedAsset(id, { spaceId: space });
                }
                finally {
                  lock.release();
                }
              }),
            );
            const sharedAssets = resolved.filter((asset): asset is Asset => Boolean(asset?.id));

            if (sharedAssets.length > 0) {
              const resolveRoot = await buildLibraryRootResolver(space);
              const byLibrary = new Map<number, Asset[]>();
              for (const asset of sharedAssets) {
                const libraryId = resolveRoot(asset.asset_folder_id ?? 0);
                const bucket = byLibrary.get(libraryId) ?? [];
                bucket.push(asset);
                byLibrary.set(libraryId, bucket);
              }
              for (const [libraryId, assets] of byLibrary) {
                await pullReferencedAssets(libraryId, assets);
              }
            }
          }
        }
      }
    }
    catch (maybeError) {
      fatalError = true;
      handleError(toError(maybeError));
    }
    finally {
      logger.info('Pulling assets finished', { summary: { ...summary } });
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
