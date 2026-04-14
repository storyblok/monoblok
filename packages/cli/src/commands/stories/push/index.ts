import { pipeline } from 'node:stream/promises';
import { join } from 'pathe';
import type { Story } from '../constants';
import { colorPalette, commands, directories } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { session } from '../../../session';
import { storiesCommand } from '../command';
import { loadManifest, resolveCommandPath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { createStoriesForLevel, groupStoriesByDepth, makeAppendToManifestFSTransport, makeCleanupStoryFSTransport, makeWriteStoryAPITransport, mapReferencesStream, readLocalStoriesStream, scanLocalStoryIndex, writeStoryStream } from '../streams';
import { findComponentSchemas } from '../utils';
import { loadAssetMap } from '../../assets/utils';
import { prefetchTargetStories } from '../actions';
import { collectSchemaIssues, formatSchemaIssues, hasSchemaIssues } from '../validate-story';

const pushCmd = storiesCommand
  .command('push')
  .option('-s, --space <space>', 'space ID')
  .option('-f, --from <from>', 'source space id')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('--publish', 'Publish stories after pushing')
  .option('--cleanup', 'delete local stories after a successful push (note: does not cleanup manifests)')
  .description(`Push local stories to a Storyblok space.`);

pushCmd
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
    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const pendingWarnings: string[] = [];

    const formatStoryLabel = (info: { slug?: string; uuid?: string; filename?: string }): string => {
      const parts: string[] = [];
      if (info.slug) { parts.push(`"${info.slug}"`); }
      if (info.uuid) { parts.push(`(${info.uuid})`); }
      if (info.filename) { parts.push(`[${info.filename}]`); }
      return parts.join(' ') || 'unknown story';
    };

    const failedStoryLabels: string[] = [];
    const summary = {
      creationResults: { total: 0, succeeded: 0, skipped: 0, failed: 0 },
      processResults: { total: 0, succeeded: 0, failed: 0 },
      updateResults: { total: 0, succeeded: 0, failed: 0 },
    };
    try {
      const manifestFile = join(resolveCommandPath(directories.stories, fromSpace, basePath), 'manifest.jsonl');
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

      // Pre-flight schema validation. Aborts before any API call if a story's
      // content references a missing component, or has fields that the local
      // schema does not declare (schema drift).
      const schemaIssues = await collectSchemaIssues({ directoryPath: storiesDirectoryPath, schemas });
      if (hasSchemaIssues(schemaIssues)) {
        const message = formatSchemaIssues(schemaIssues);
        ui.error(message);
        logger.error(message);
        // Surface the failure in the run summary so the report status is
        // FAILURE rather than a trivial zero-counts SUCCESS.
        const total = Math.max(schemaIssues.total, 1);
        summary.creationResults.total = total;
        summary.creationResults.failed = total;
        return;
      }

      // Warn when story content includes custom plugin payloads. References
      // embedded inside a plugin's opaque JSON can't be auto-remapped, so the
      // user may need to update them manually. Emitted once per plugin name
      // per story during Pass 2, after schema validation has confirmed the
      // content shape is trustworthy.
      const warnAboutCustomPlugins = (story: Story) => {
        const warned = new Set<string>();
        const visit = (node: unknown): void => {
          if (Array.isArray(node)) {
            for (const item of node) { visit(item); }
            return;
          }
          if (!node || typeof node !== 'object') { return; }
          const obj = node as Record<string, unknown>;
          const plugin = obj.plugin;
          if (typeof plugin === 'string' && !warned.has(plugin)) {
            warned.add(plugin);
            const message = `The custom plugin "${plugin}" may contain references that require manual updates.`;
            pendingWarnings.push(message);
            logger.warn(message, { storyId: story.uuid });
          }
          for (const value of Object.values(obj)) { visit(value); }
        };
        visit(story.content);
      };

      const fetchProgress = ui.createProgressBar({ title: 'Matching Stories...'.padEnd(21) });
      const existingTargetStories = await prefetchTargetStories(space, {
        onTotal: total => fetchProgress.setTotal(total),
        onIncrement: count => fetchProgress.increment(count),
      });
      fetchProgress.stop();

      /**
       * Pass 1: Scan local stories, group by depth, and create remote
       * placeholders level-by-level so that parent folders exist before
       * their children are created.
       */
      const scanProgress = ui.createProgressBar({ title: 'Scanning Stories...'.padEnd(21) });
      const storyIndex = await scanLocalStoryIndex({
        directoryPath: storiesDirectoryPath,
        setTotalStories(total) {
          scanProgress.setTotal(total);
        },
        onIncrement() {
          scanProgress.increment();
        },
        onError(error, filename) {
          summary.creationResults.failed += 1;
          const label = formatStoryLabel({ filename });
          failedStoryLabels.push(label);
          ui.error(`Story failed: ${label}`, null, { header: false, margin: false });
          handleError(error, verbose, { storyFile: filename });
        },
      });
      const levels = groupStoriesByDepth(storyIndex);
      scanProgress.stop();

      const creationProgress = ui.createProgressBar({ title: 'Creating Stories...'.padEnd(21) });
      const processProgress = ui.createProgressBar({ title: 'Processing Stories...'.padEnd(21) });
      const updateProgress = ui.createProgressBar({ title: 'Updating Stories...'.padEnd(21) });
      const totalStories = storyIndex.length + summary.creationResults.failed;
      summary.creationResults.total = totalStories;
      summary.processResults.total = totalStories;
      summary.updateResults.total = totalStories;
      creationProgress.setTotal(totalStories);
      processProgress.setTotal(totalStories);
      updateProgress.setTotal(totalStories);

      const appendToManifest = options.dryRun
        ? (() => Promise.resolve()) as ReturnType<typeof makeAppendToManifestFSTransport>
        : makeAppendToManifestFSTransport({ manifestFile });

      // Tracks which remote story IDs have been matched to a local entry,
      // preventing two local stories from mapping to the same remote
      // (e.g. after slug swaps or renames between pushes).
      const claimedRemoteIds = new Set<number>();

      for (const level of levels) {
        await createStoriesForLevel({
          level,
          spaceId: space,
          maps,
          existingTargetStories,
          claimedRemoteIds,
          isCrossSpace: fromSpace !== space,
          dryRun: options.dryRun ?? false,
          appendToManifest,
          onStorySuccess(entry, remoteStory) {
            if (!entry.uuid || !remoteStory.uuid) {
              throw new Error('Invalid story provided!');
            }
            maps.stories.set(entry.id, remoteStory.id);
            maps.stories.set(entry.uuid, remoteStory.uuid);
            logger.info('Created story', { storyId: remoteStory.uuid });
            summary.creationResults.succeeded += 1;
            creationProgress.increment();
          },
          onStorySkipped(entry, remoteStory, reason) {
            if (!entry.uuid || !remoteStory.uuid) {
              throw new Error('Invalid story provided!');
            }
            maps.stories.set(entry.id, remoteStory.id);
            maps.stories.set(entry.uuid, remoteStory.uuid);
            logger.info(`Skipped creating story: ${reason}`, { storyId: entry.uuid });
            summary.creationResults.skipped += 1;
            creationProgress.increment();
          },
          onStoryError(error, entry) {
            summary.creationResults.failed += 1;
            summary.processResults.total -= 1;
            summary.updateResults.total -= 1;
            processProgress.setTotal(summary.processResults.total);
            updateProgress.setTotal(summary.updateResults.total);
            creationProgress.increment();
            const label = formatStoryLabel({ slug: entry?.slug, uuid: entry?.uuid, filename: entry?.filename });
            failedStoryLabels.push(label);
            ui.error(`Story failed: ${label}`, null, { header: false, margin: false });
            handleError(error, verbose, { storyId: entry?.uuid });
          },
        });
      }

      if (summary.creationResults.failed > 0) {
        const message = `${summary.creationResults.failed} ${summary.creationResults.failed === 1 ? 'story' : 'stories'} failed to create. References to these stories will be left unmapped.`;
        pendingWarnings.push(message);
        logger.warn(message);
      }

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
          onStoryError(error, filename) {
            summary.creationResults.failed += 1;
            summary.processResults.total -= 1;
            summary.updateResults.total -= 1;
            processProgress.setTotal(summary.processResults.total);
            updateProgress.setTotal(summary.updateResults.total);
            const label = formatStoryLabel({ filename });
            failedStoryLabels.push(label);
            ui.error(`Story failed: ${label}`, null, { header: false, margin: false });
            handleError(error, verbose, { storyFile: filename });
          },
        }),
        // Map all references to numeric ids and uuids.
        mapReferencesStream({
          schemas,
          maps,
          onIncrement() {
            processProgress.increment();
          },
          onStorySuccess(localStory) {
            warnAboutCustomPlugins(localStory);
            logger.info('Processed story', { storyId: localStory.uuid });
            summary.processResults.succeeded += 1;
          },
          onStoryError(error, localStory) {
            summary.processResults.failed += 1;
            summary.updateResults.total -= 1;
            updateProgress.setTotal(summary.updateResults.total);
            const label = formatStoryLabel({ slug: localStory.slug, uuid: localStory.uuid });
            failedStoryLabels.push(label);
            ui.error(`Story failed: ${label}`, null, { header: false, margin: false });
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
            const label = formatStoryLabel({ slug: localStory.slug, uuid: localStory.uuid });
            failedStoryLabels.push(label);
            ui.error(`Story failed: ${label}`, null, { header: false, margin: false });
            handleError(error, verbose, { storyId: localStory.uuid });
          },
        }),
      );
    }
    catch (maybeError) {
      handleError(toError(maybeError), verbose);
    }
    finally {
      logger.info('Pushing stories finished', summary);
      ui.stopAllProgressBars();
      for (const warning of pendingWarnings) {
        ui.warn(warning);
      }
      const failedStories = Math.max(summary.creationResults.failed, summary.processResults.failed, summary.updateResults.failed);
      ui.info(`Push results: ${summary.creationResults.total} ${summary.creationResults.total === 1 ? 'story' : 'stories'} pushed, ${failedStories} ${failedStories === 1 ? 'story' : 'stories'} failed`);
      ui.list([
        `Creating stories: ${summary.creationResults.succeeded + summary.creationResults.skipped}/${summary.creationResults.total} succeeded, ${summary.creationResults.failed} failed.`,
        `Processing stories: ${summary.processResults.succeeded}/${summary.processResults.total} succeeded, ${summary.processResults.failed} failed.`,
        `Updating stories: ${summary.updateResults.succeeded}/${summary.updateResults.total} succeeded, ${summary.updateResults.failed} failed.`,
      ]);

      if (failedStoryLabels.length > 0) {
        ui.warn('Failed stories:');
        ui.list(failedStoryLabels);
      }

      reporter.addSummary('creationResults', summary.creationResults);
      reporter.addSummary('processResults', summary.processResults);
      reporter.addSummary('updateResults', summary.updateResults);
      if (failedStoryLabels.length > 0) {
        reporter.addMeta('failedStories', failedStoryLabels);
      }
      reporter.finalize();
    }
  });
