import { pipeline } from 'node:stream/promises';
import type { Component } from '@storyblok/management-api-client/resources/components';
import type { UI } from '../../utils/ui';
import type { WriteStoryTransport } from '../stories/streams';
import { fetchStoriesStream, fetchStoryStream, mapReferencesStream, writeStoryStream } from '../stories/streams';
import type { Logger } from '../../lib/logger/logger';
import type { Report } from '../../lib/reporter/reporter';
import { logOnlyError } from '../../utils/error/error';
import type {
  AppendAssetFolderManifestTransport,
  AppendAssetManifestTransport,
  CleanupAssetFolderTransport,
  CleanupAssetTransport,
  CreateAssetFolderTransport,
  CreateAssetTransport,
  DownloadAssetFileTransport,
  GetAssetFolderTransport,
  GetAssetTransport,
  UpdateAssetFolderTransport,
  UpdateAssetTransport,
} from './streams';
import { readLocalAssetFoldersStream, readLocalAssetsStream, readSingleAssetStream, upsertAssetFolderStream, upsertAssetStream } from './streams';
import type { AssetFolderMap, AssetMap, AssetUpload } from './types';
import type { Story } from '@storyblok/management-api-client/resources/stories';

const PROGRESS_BAR_PADDING = 23;

type Summaries = [string, Report['summary'][string]][];

export const upsertAssetFoldersPipeline = async ({
  directoryPath,
  logger,
  maps,
  transports,
  ui,
}: {
  directoryPath: string;
  logger: Logger;
  maps: { assetFolders: AssetFolderMap };
  transports: {
    getAssetFolder: GetAssetFolderTransport;
    createAssetFolder: CreateAssetFolderTransport;
    updateAssetFolder: UpdateAssetFolderTransport;
    appendAssetFolderManifest: AppendAssetFolderManifestTransport;
    cleanupAssetFolder?: CleanupAssetFolderTransport;
  };
  ui: UI;
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
        logOnlyError(error);
      },
    }),
    upsertAssetFolderStream({
      transports,
      maps,
      onIncrement: () => folderProgress.increment(),
      onFolderSuccess: (localFolder, remoteFolder) => {
        summary.succeeded += 1;
        maps.assetFolders.set(localFolder.id, remoteFolder.id);
        logger.info('Created asset folder', { folderId: remoteFolder.id });
      },
      onFolderError: (error, folder) => {
        summary.failed += 1;
        logOnlyError(error, { folderId: folder.id });
      },
    }),
  );

  return [['assetFolderResults', summary]];
};

export const upsertAssetsPipeline = async ({
  assetSource,
  assetData,
  directoryPath,
  logger,
  maps,
  transports,
  ui,
}: {
  assetSource?: string;
  assetData?: AssetUpload;
  directoryPath: string;
  logger: Logger;
  maps: { assets: AssetMap; assetFolders: AssetFolderMap };
  transports: {
    getAsset: GetAssetTransport;
    createAsset: CreateAssetTransport;
    updateAsset: UpdateAssetTransport;
    downloadAssetFile: DownloadAssetFileTransport;
    appendAssetManifest: AppendAssetManifestTransport;
    cleanupAsset: CleanupAssetTransport;
  };
  ui: UI;
}): Promise<Summaries> => {
  const assetProgress = ui.createProgressBar({ title: 'Assets...'.padEnd(PROGRESS_BAR_PADDING) });
  const summary = { total: 0, succeeded: 0, failed: 0, skipped: 0 };

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
        logOnlyError(error);
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
        logOnlyError(error);
      },
    }));
  }

  steps.push(upsertAssetStream({
    transports,
    maps,
    onIncrement: () => assetProgress.increment(),
    onAssetSuccess: (localAssetResult, remoteAsset) => {
      if ('id' in localAssetResult && localAssetResult.id) {
        maps.assets.set(localAssetResult.id, {
          old: localAssetResult,
          new: {
            id: remoteAsset.id,
            filename: remoteAsset.filename,
            meta_data: remoteAsset.meta_data,
          },
        });
      }

      summary.succeeded += 1;
      logger.info('Uploaded asset', { assetId: remoteAsset.id });
    },
    onAssetSkipped: (localAssetResult, remoteAsset) => {
      if ('id' in localAssetResult && localAssetResult.id) {
        maps.assets.set(localAssetResult.id, {
          old: localAssetResult,
          new: {
            id: remoteAsset.id,
            filename: remoteAsset.filename,
            meta_data: remoteAsset.meta_data,
          },
        });
      }

      summary.skipped += 1;
      logger.debug('Skipped asset (unchanged)', { assetId: remoteAsset.id });
    },
    onAssetError: (error, asset) => {
      summary.failed += 1;
      logOnlyError(error, { assetId: asset.id });
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
}: {
  logger: Logger;
  maps: { assets: AssetMap };
  schemas: Record<Component['name'], Component['schema']>;
  space: string;
  transports: {
    writeStory: WriteStoryTransport;
  };
  ui: UI;
}): Promise<Summaries> => {
  if (Object.keys(schemas).length === 0) {
    const message = 'No components found. Please run `storyblok components pull` to fetch the latest components.';
    ui.error(message);
    logger.error(message);
    return [];
  }

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

  const warnAboutMissingSchemas = (missingSchemas: Set<Component['name']>, story: Story) => {
    const missingSchemaWarnings = new Set<string>();
    for (const schemaName of missingSchemas) {
      if (missingSchemaWarnings.has(schemaName)) {
        continue;
      }
      const message = `The component "${schemaName}" was not found. Please run \`storyblok components pull\` to fetch the latest components.`;
      logger.warn(message, { storyId: story.uuid });
      missingSchemaWarnings.add(schemaName);
    }
  };

  // If we only have one asset map entry, we can filter for stories referencing this asset.
  const assetMapValues = [...maps.assets.values()];
  const reference_search = assetMapValues.length === 1 ? assetMapValues[0].new.filename : undefined;

  await pipeline(
    fetchStoriesStream({
      spaceId: space,
      params: {
        reference_search,
      },
      setTotalPages: (totalPages) => {
        summaries.fetchStoryPages.total = totalPages;
        fetchStoryPagesProgress.setTotal(totalPages);
      },
      setTotalStories: (total) => {
        summaries.fetchStories.total = total;
        summaries.storyProcessResults.total = total;
        summaries.storyUpdateResults.total = total;
        fetchStoriesProgress.setTotal(total);
        processProgress.setTotal(total);
        updateProgress.setTotal(total);
      },
      onIncrement: () => fetchStoryPagesProgress.increment(),
      onPageSuccess: (page, total) => {
        logger.info(`Fetched stories page ${page} of ${total}`);
        summaries.fetchStoryPages.succeeded += 1;
      },
      onPageError: (error, page, total) => {
        summaries.fetchStoryPages.failed += 1;
        logOnlyError(error, { page, total });
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
        logOnlyError(error, { storyId: story.id });
      },
    }),
    // Map all references to numeric ids and uuids.
    mapReferencesStream({
      schemas,
      maps: { stories: new Map(), ...maps },
      onIncrement() {
        processProgress.increment();
      },
      onStorySuccess(localStory, _, missingSchemas) {
        warnAboutMissingSchemas(missingSchemas, localStory);
        logger.info('Processed story', { storyId: localStory.uuid });
        summaries.storyProcessResults.succeeded += 1;
      },
      onStoryError(error, localStory) {
        summaries.storyProcessResults.failed += 1;
        summaries.storyUpdateResults.total -= 1;
        updateProgress.setTotal(summaries.storyUpdateResults.total);
        logOnlyError(error, { storyId: localStory.id });
      },
    }),
    // Update remote stories with correct references.
    writeStoryStream({
      transports: {
        writeStory: transports.writeStory,
      },
      onIncrement() {
        updateProgress.increment();
      },
      onStorySuccess(localStory) {
        logger.info('Updated story', { storyId: localStory.uuid });
        summaries.storyUpdateResults.succeeded += 1;
      },
      onStoryError(error, localStory) {
        summaries.storyUpdateResults.failed += 1;
        logOnlyError(error, { storyId: localStory.id });
      },
    }),
  );

  return Object.entries(summaries);
};
