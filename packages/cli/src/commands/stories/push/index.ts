import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import type { Component } from '@storyblok/management-api-client/resources/components';
import { colorPalette, commands, directories } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { session } from '../../../session';
import { storiesCommand } from '../command';
import { mapiClient } from '../../../api';
import { loadManifest, resolveCommandPath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { createStoryPlaceholderStream, makeAppendToManifestFSTransport, makeCleanupStoryFSTransport, makeCreateStoryAPITransport, makeWriteStoryAPITransport, mapReferencesStream, readLocalStoriesStream, writeStoryStream } from '../streams';
import { findComponentSchemas } from '../utils';
import { loadAssetMap } from '../../assets/utils';
import type { Story } from '@storyblok/management-api-client/resources/stories';

storiesCommand
  .command('push')
  .option('-f, --from <from>', 'source space id')
  .option('-p, --path <path>', 'base path for stories and components (default .storyblok)')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('--publish', 'Publish stories after pushing')
   .option('--cleanup', 'delete local stories after a successful push (note: does not cleanup manifests)')
  .description(`Push local stories to a Storyblok space.`)
  .action(async (options, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();

    ui.title(`${commands.STORIES}`, colorPalette.STORIES, 'Pushing stories...');
    logger.info('Pushing stories started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const fromSpace = options.from || space;
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

    const warnAboutCustomPlugins = (fields: Set<Component['schema']>, story: Story) => {
      const warnedPlugins = new Set<string>();
      for (const field of fields) {
        if (field.type === 'custom' && typeof field.field_type === 'string') {
          if (warnedPlugins.has(field.field_type)) {
            continue;
          }
          warnedPlugins.add(field.field_type);
          const message = `The custom plugin "${field.field_type}" may contain references that require manual updates.`;
          ui.warn(message);
          logger.warn(message, { storyId: story.uuid });
        }
      }
    };
    const warnAboutMissingSchemas = (missingSchemas: Set<Component['name']>, story: Story) => {
      const missingSchemaWarnings = new Set<string>();
      for (const schemaName of missingSchemas) {
        if (missingSchemaWarnings.has(schemaName)) {
          continue;
        }
        const message = `The component "${schemaName}" was not found. Please run \`storyblok components pull\` to fetch the latest components.`;
        ui.warn(message);
        logger.warn(message, { storyId: story.uuid });
        missingSchemaWarnings.add(schemaName);
      }
    };

    const summary = {
      creationResults: { total: 0, succeeded: 0, skipped: 0, failed: 0 },
      processResults: { total: 0, succeeded: 0, failed: 0 },
      updateResults: { total: 0, succeeded: 0, failed: 0 },
    };
    try {
      const manifestFile = join(resolveCommandPath(directories.stories, space, basePath), 'manifest.jsonl');
      const manifest = await loadManifest(manifestFile);
      const assetManifestFile = join(resolveCommandPath(directories.assets, fromSpace, basePath), 'manifest.jsonl');
      const maps = {
        assets: await loadAssetMap(assetManifestFile),
        stories: new Map<unknown, string | number>(manifest.map(e => [e.old_id, e.new_id])),
      };

      const schemas = await findComponentSchemas(resolveCommandPath(directories.components, fromSpace, basePath));
      if (Object.keys(schemas).length === 0) {
        const message = 'No components found. Please run `storyblok components pull` to fetch the latest components.';
        ui.error(message);
        logger.error(message);
        return;
      }

      const storiesDirectoryPath = resolveCommandPath(directories.stories, fromSpace, basePath);
      const creationProgress = ui.createProgressBar({ title: 'Creating Stories...'.padEnd(21) });
      const processProgress = ui.createProgressBar({ title: 'Processing Stories...'.padEnd(21) });
      const updateProgress = ui.createProgressBar({ title: 'Updating Stories...'.padEnd(21) });

      /**
       * Pass 1: Create remote stories and map their (UU)IDs to existing local stories.
       */
      await pipeline(
        // Read local stories from `.json` files.
        readLocalStoriesStream({
          directoryPath: storiesDirectoryPath,
          setTotalStories(total) {
            summary.creationResults.total = total;
            summary.processResults.total = total;
            summary.updateResults.total = total;
            creationProgress.setTotal(total);
            processProgress.setTotal(total);
            updateProgress.setTotal(total);
          },
          onStoryError(error) {
            summary.creationResults.failed += 1;
            summary.processResults.total -= 1;
            summary.updateResults.total -= 1;
            processProgress.setTotal(summary.processResults.total);
            updateProgress.setTotal(summary.updateResults.total);
            creationProgress.increment();
            handleError(error, verbose);
          },
        }),
        // Create remote stories.
        createStoryPlaceholderStream({
          maps,
          spaceId: space,
          transports: {
            createStory: options.dryRun
              ? async (story: Story) => story
              : makeCreateStoryAPITransport({
                  maps,
                  spaceId: space,
                }),
            appendStoryManifest: options.dryRun
              ? () => Promise.resolve()
              : makeAppendToManifestFSTransport({
                  manifestFile,
                }),
          },
          onStorySuccess(localStory, remoteStory) {
            if (!localStory.uuid || !remoteStory.uuid) {
              throw new Error('Invalid story provided!');
            }
            maps.stories.set(localStory.id, remoteStory.id);
            maps.stories.set(localStory.uuid, remoteStory.uuid);
            logger.info('Created story', { storyId: remoteStory.uuid });
            summary.creationResults.succeeded += 1;
          },
          onStorySkipped(localStory, remoteStory) {
            if (!localStory.uuid || !remoteStory.uuid) {
              throw new Error('Invalid story provided!');
            }
            maps.stories.set(localStory.id, remoteStory.id);
            maps.stories.set(localStory.uuid, remoteStory.uuid);
            logger.info('Skipped creating story', { storyId: localStory.uuid });
            summary.creationResults.skipped += 1;
          },
          onStoryError(error) {
            summary.creationResults.failed += 1;
            summary.processResults.total -= 1;
            summary.updateResults.total -= 1;
            processProgress.setTotal(summary.processResults.total);
            updateProgress.setTotal(summary.updateResults.total);
            handleError(error, verbose);
          },
          onIncrement() {
            creationProgress.increment();
          },
        }),
      );

      /**
       * Pass 2: Update remote stories with corrected references.
       *
       * We need to run the second pass in a separate pipeline because we need a
       * complete map of all stories.
       */
      await pipeline(
        // Read local stories from `.json` files.
        readLocalStoriesStream({
          directoryPath: storiesDirectoryPath,
          fileFilter({ uuid }) {
            // Only load files that were successfully created and mapped.
            return Boolean(maps.stories.get(uuid));
          },
          setTotalStories(total) {
            summary.processResults.total = total;
            summary.updateResults.total = total;
            processProgress.setTotal(total);
            updateProgress.setTotal(total);
          },
          onStoryError(error) {
            summary.creationResults.failed += 1;
            summary.processResults.total -= 1;
            summary.updateResults.total -= 1;
            processProgress.setTotal(summary.processResults.total);
            updateProgress.setTotal(summary.updateResults.total);
            handleError(error, verbose);
          },
        }),
        // Map all references to numeric ids and uuids.
        mapReferencesStream({
          schemas,
          maps,
          onIncrement() {
            processProgress.increment();
          },
          onStorySuccess(localStory, processedFields, missingSchemas) {
            warnAboutCustomPlugins(processedFields, localStory);
            warnAboutMissingSchemas(missingSchemas, localStory);
            logger.info('Processed story', { storyId: localStory.uuid });
            summary.processResults.succeeded += 1;
          },
          onStoryError(error, localStory) {
            summary.processResults.failed += 1;
            summary.updateResults.total -= 1;
            updateProgress.setTotal(summary.updateResults.total);
            handleError(error, verbose, { storyId: localStory.uuid });
          },
        }),
        // Update remote stories with correct references.
        writeStoryStream({
          transports: {
            writeStory: options.dryRun
              ? async (story: Story) => story
              : makeWriteStoryAPITransport({
                  spaceId: space,
                  publish: options.publish ? 1 : undefined,
                }),
            cleanupStory: options.cleanup && !options.dryRun
              ? makeCleanupStoryFSTransport({ directoryPath: storiesDirectoryPath, maps })
              : undefined,
          },
          onIncrement() {
            updateProgress.increment();
          },
          onStorySuccess(localStory) {
            logger.info('Updated story', { storyId: localStory.uuid });
            summary.updateResults.succeeded += 1;
          },
          onStoryError(error, localStory) {
            summary.updateResults.failed += 1;
            handleError(error, verbose, { storyId: localStory.uuid });
          },
        }),
      );
    }
    catch (maybeError) {
      handleError(toError(maybeError));
    }
    finally {
      logger.info('Pushing stories finished', summary);
      ui.stopAllProgressBars();
      const failedStories = Math.max(summary.creationResults.failed, summary.processResults.failed, summary.updateResults.failed);
      ui.info(`Push results: ${summary.creationResults.total} ${summary.creationResults.total === 1 ? 'story' : 'stories'} pushed, ${failedStories} ${failedStories === 1 ? 'story' : 'stories'} failed`);
      ui.list([
        `Creating stories: ${summary.creationResults.succeeded + summary.creationResults.skipped}/${summary.creationResults.total} succeeded, ${summary.creationResults.failed} failed.`,
        `Processing stories: ${summary.processResults.succeeded}/${summary.processResults.total} succeeded, ${summary.processResults.failed} failed.`,
        `Updating stories: ${summary.updateResults.succeeded}/${summary.updateResults.total} succeeded, ${summary.updateResults.failed} failed.`,
      ]);

      reporter.addSummary('creationResults', summary.creationResults);
      reporter.addSummary('processResults', summary.processResults);
      reporter.addSummary('updateResults', summary.updateResults);
      reporter.finalize();
    }
  });
