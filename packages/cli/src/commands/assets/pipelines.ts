import { pipeline } from 'node:stream/promises';
import type { Component } from '@storyblok/management-api-client/resources/components';
import type { UI } from '../../utils/ui';
import type { WriteStoryTransport } from '../stories/streams';
import { fetchStoriesStream, fetchStoryStream, mapReferencesStream, writeStoryStream } from '../stories/streams';
import type { Logger } from '../../lib/logger/logger';
import type { Report } from '../../lib/reporter/reporter';
import { handleError } from '../../utils/error/error';
import type { AppendAssetFolderManifestTransport, AppendAssetManifestTransport, CreateAssetFolderTransport, CreateAssetTransport, GetAssetFolderTransport, GetAssetTransport, UpdateAssetFolderTransport, UpdateAssetTransport } from './streams';
import { readLocalAssetFoldersStream, readLocalAssetsStream, readSingleAssetStream, upsertAssetFolderStream, upsertAssetStream } from './streams';
import type { AssetUpload } from './types';

const PROGRESS_BAR_PADDING = 23;

type Summaries = [string, Report['summary'][string]][];

export const upsertAssetFoldersPipeline = async ({
  directoryPath,
  logger,
  maps,
  transports,
  ui,
  verbose,
}: {
  directoryPath: string;
  logger: Logger;
  maps: { assetFolders: Map<number, number> };
  transports: {
    get: GetAssetFolderTransport;
    create: CreateAssetFolderTransport;
    update: UpdateAssetFolderTransport;
    manifest: AppendAssetFolderManifestTransport;
  };
  ui: UI;
  verbose: boolean;
}): Promise<Summaries> => {
  const folderProgress = ui.createProgressBar({ title: 'Folders...'.padEnd(PROGRESS_BAR_PADDING) });
  const summary = { total: 0, succeeded: 0, failed: 0 };

  await pipeline(
    readLocalAssetFoldersStream({
      directoryPath,
      setTotalFolders: (total) => {
        summary.total = total;
        folderProgress.setTotal(total);
      },
      onFolderError: (error) => {
        summary.failed += 1;
        handleError(error, verbose);
      },
    }),
    upsertAssetFolderStream({
      getTransport: transports.get,
      createTransport: transports.create,
      updateTransport: transports.update,
      manifestTransport: transports.manifest,
      maps,
      onIncrement: () => folderProgress.increment(),
      onFolderSuccess: (localFolder, remoteFolder) => {
        summary.succeeded += 1;
        maps.assetFolders.set(localFolder.id, remoteFolder.id);
        logger.info('Created asset folder', { folderId: remoteFolder.id });
      },
      onFolderError: (error, folder) => {
        summary.failed += 1;
        handleError(error, verbose, { folderId: folder.id });
      },
    }),
  );

  return [['assetFolderResults', summary]];
};

export const upsertAssetsPipeline = async ({
  assetSource,
  assetData,
  cleanup,
  directoryPath,
  logger,
  maps,
  transports,
  ui,
  verbose,
}: {
  assetSource?: string;
  assetData?: AssetUpload;
  cleanup: boolean;
  directoryPath: string;
  logger: Logger;
  maps: { assets: Map<number, number>; assetFolders: Map<number, number> };
  transports: {
    get: GetAssetTransport;
    create: CreateAssetTransport;
    update: UpdateAssetTransport;
    manifest: AppendAssetManifestTransport;
  };
  ui: UI;
  verbose: boolean;
}): Promise<Summaries> => {
  const assetProgress = ui.createProgressBar({ title: 'Assets...'.padEnd(PROGRESS_BAR_PADDING) });
  const summary = { total: 0, succeeded: 0, failed: 0 };

  const steps = [];
  // Use the asset provided via the CLI.
  if (assetSource && assetData) {
    summary.total = 1;
    assetProgress.setTotal(1);

    steps.push(readSingleAssetStream({
      asset: assetData,
      assetSource,
      onAssetError: (error) => {
        summary.failed += 1;
        assetProgress.increment();
        handleError(error, verbose);
      },
    }));
  }
  // Read assets from the local file system.
  else {
    steps.push(readLocalAssetsStream({
      directoryPath,
      setTotalAssets: (total) => {
        summary.total = total;
        assetProgress.setTotal(total);
      },
      onAssetError: (error) => {
        summary.failed += 1;
        assetProgress.increment();
        handleError(error, verbose);
      },
    }));
  }

  steps.push(upsertAssetStream({
    getTransport: transports.get,
    createTransport: transports.create,
    updateTransport: transports.update,
    manifestTransport: transports.manifest,
    maps,
    cleanup,
    onIncrement: () => assetProgress.increment(),
    onAssetSuccess: (localAssetResult, remoteAsset) => {
      if (localAssetResult.id) {
        maps.assets.set(localAssetResult.id, remoteAsset.id);
      }
      // TODO types
      if (localAssetResult.filename) {
        maps.assets.set(localAssetResult.filename, remoteAsset.filename);
      }
      summary.succeeded += 1;
      logger.info('Uploaded asset', { assetId: remoteAsset.id });
    },
    onAssetError: (error, asset) => {
      summary.failed += 1;
      handleError(error, verbose, { assetId: asset.id });
    },
  }));
  await pipeline(steps);

  return [['assetResults', summary]];
};

export const mapAssetReferencesInStoriesPipeline = async ({
  logger,
  maps,
  schemas,
  space,
  transports,
  ui,
  verbose,
}: {
  logger: Logger;
  maps: { assets: Map<number, number> };
  schemas: Record<Component['name'], Component['schema']>;
  space: string;
  transports: {
    write: WriteStoryTransport;
  };
  ui: UI;
  verbose: boolean;
}): Promise<Summaries> => {
  // TODO check how this behaves if it is rendered conditionally only
  const fetchStoryPagesProgress = ui.createProgressBar({ title: 'Fetching Story Pages...'.padEnd(PROGRESS_BAR_PADDING) });
  const fetchStoriesProgress = ui.createProgressBar({ title: 'Fetching Stories...'.padEnd(PROGRESS_BAR_PADDING) });
  const processProgress = ui.createProgressBar({ title: 'Processing Stories...'.padEnd(PROGRESS_BAR_PADDING) });
  const updateProgress = ui.createProgressBar({ title: 'Updating Stories...'.padEnd(PROGRESS_BAR_PADDING) });

  const summaries = {
    fetchStoryPages: { total: 0, succeeded: 0, failed: 0 },
    fetchStories: { total: 0, succeeded: 0, failed: 0 },
    storyProcessResults: { total: 0, succeeded: 0, failed: 0 },
    storyUpdateResults: { total: 0, succeeded: 0, failed: 0 },
  };

  if (Object.keys(schemas).length === 0) {
    const message = 'No components found. Please run `storyblok components pull` to fetch the latest components.';
    ui.error(message);
    logger.error(message);
    return [];
  }

  await pipeline(
    fetchStoriesStream({
      spaceId: space,
      setTotalPages: (totalPages) => {
        summaries.fetchStoryPages.total = totalPages;
        fetchStoryPagesProgress.setTotal(totalPages);
      },
      setTotalStories: (total) => {
        summaries.fetchStories.total = total;
        summaries.storyProcessResults.total = total;
        summaries.storyUpdateResults.total = total;
        fetchStoriesProgress.setTotal(total);
      },
      onIncrement: () => fetchStoryPagesProgress.increment(),
      onPageSuccess: (page, total) => {
        logger.info(`Fetched stories page ${page} of ${total}`);
        summaries.fetchStoryPages.succeeded += 1;
      },
      onPageError: (error, page, total) => {
        summaries.fetchStoryPages.failed += 1;
        handleError(error, verbose, { page, total });
      },
    }),
    fetchStoryStream({
      spaceId: space,
      onIncrement: () => {
        fetchStoriesProgress.increment();
      },
      onStorySuccess: (story) => {
        logger.info('Fetched story', { storyId: story.id });
        summaries.fetchStories.succeeded += 1;
      },
      onStoryError: (error, story) => {
        summaries.fetchStories.failed += 1;
        summaries.storyProcessResults.total -= 1;
        summaries.storyUpdateResults.total -= 1;
        processProgress.setTotal(summaries.storyProcessResults.total);
        updateProgress.setTotal(summaries.storyProcessResults.total);
        handleError(error, verbose, { storyId: story.id });
      },
    }),
    // Map all references to numeric ids and uuids.
    mapReferencesStream({
      schemas,
      maps: { stories: new Map(), ...maps },
      onIncrement() {
        processProgress.increment();
      },
      onStorySuccess(localStory, processedFields, missingSchemas) {
        // TODO
        // warnAboutMissingSchemas(missingSchemas, localStory);
        logger.info('Processed story', { storyId: localStory.uuid });
        summaries.storyProcessResults.succeeded += 1;
      },
      onStoryError(error, localStory) {
        summaries.storyProcessResults.failed += 1;
        summaries.storyUpdateResults.total -= 1;
        updateProgress.setTotal(summaries.storyUpdateResults.total);
        handleError(error, verbose, { storyId: localStory.id });
      },
    }),
    // Update remote stories with correct references.
    writeStoryStream({
      transport: transports.write,
      onIncrement() {
        updateProgress.increment();
      },
      onStorySuccess(localStory) {
        logger.info('Updated story', { storyId: localStory.uuid });
        summaries.storyUpdateResults.succeeded += 1;
      },
      onStoryError(error, localStory) {
        summaries.storyUpdateResults.failed += 1;
        handleError(error, verbose, { storyId: localStory.id });
      },
    }),
  );

  return Object.entries(summaries);
};
