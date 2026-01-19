import { pipeline } from 'node:stream/promises';
import type { Story } from '@storyblok/management-api-client/resources/stories';
import { colorPalette, commands, directories } from '../../../constants';
import { session } from '../../../session';
import { storiesCommand } from '../command';
import { mapiClient } from '../../../api';
import { resolveCommandPath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { fetchStoriesStream, fetchStoryStream, makeWriteStoryFSTransport, writeStoryStream } from '../streams';
import { requireAuthentication } from '../../../utils/auth';
import { handleError, toError } from '../../../utils/error/error';
import { CommandError } from '../../../utils/error/command-error';

storiesCommand
  .command('pull')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('-p, --path <path>', 'base path to store stories (default .storyblok)')
  .option('-q, --query <query>', 'Filter stories by content attributes using Storyblok filter query syntax. Example: --query="[highlighted][in]=true"')
  .option('--starts-with <path>', 'Filter stories by path. Example: --starts-with="/en/blog/"')
  .description(`Download your space's stories as separate json files.`)
  .action(async (options, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();

    ui.title(`${commands.STORIES}`, colorPalette.STORIES, 'Pulling stories...');
    logger.info('Pulling stories started');

    if (options.dryRun) {
      ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
      logger.warn('Dry run mode enabled');
    }

    const { space, path: basePath, verbose } = command.optsWithGlobals();
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
      fetchStoryPages: { total: 0, succeeded: 0, failed: 0 },
      fetchStories: { total: 0, succeeded: 0, failed: 0 },
      save: { total: 0, succeeded: 0, failed: 0 },
    };
    try {
      const fetchStoryPagesProgress = ui.createProgressBar({ title: 'Fetching Story Pages...'.padEnd(23) });
      const fetchStoriesProgress = ui.createProgressBar({ title: 'Fetching Stories...'.padEnd(23) });
      const saveProgress = ui.createProgressBar({ title: 'Saving Stories...'.padEnd(23) });
      await pipeline(
        fetchStoriesStream({
          spaceId: space,
          params: {
            filter_query: options.query,
            starts_with: options.startsWith,
          },
          setTotalPages: (totalPages) => {
            summary.fetchStoryPages.total = totalPages;
            fetchStoryPagesProgress.setTotal(totalPages);
          },
          setTotalStories: (total) => {
            summary.fetchStories.total = total;
            summary.save.total = total;
            fetchStoriesProgress.setTotal(total);
            saveProgress.setTotal(total);
          },
          onIncrement: () => {
            fetchStoryPagesProgress.increment();
          },
          onPageSuccess: (page, total) => {
            logger.info(`Fetched stories page ${page} of ${total}`);
            summary.fetchStoryPages.succeeded += 1;
          },
          onPageError: (error, page, total) => {
            summary.fetchStoryPages.failed += 1;
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
            summary.fetchStories.succeeded += 1;
          },
          onStoryError: (error, story) => {
            summary.fetchStories.failed += 1;
            summary.save.total -= 1;
            saveProgress.setTotal(summary.save.total);
            handleError(error, verbose, { storyId: story.id });
          },
        }),
        writeStoryStream({
          writeTransport: options.dryRun
            ? { write: (story: Story) => Promise.resolve(story) }
            : makeWriteStoryFSTransport({ directoryPath: resolveCommandPath(directories.stories, space, basePath) }),
          onIncrement: () => {
            saveProgress.increment();
          },
          onStorySuccess: (story) => {
            logger.info('Saved story', { storyId: story.id });
            summary.save.succeeded += 1;
          },
          onStoryError: (error, story) => {
            summary.save.failed += 1;
            handleError(error, verbose, { storyId: story.id });
          },
        }),
      );
    }
    catch (maybeError) {
      handleError(toError(maybeError));
    }
    finally {
      logger.info('Pulling stories finished', summary);
      ui.stopAllProgressBars();
      ui.info(`Pull results: ${summary.save.total} stories pulled, ${Math.max(summary.fetchStories.failed, summary.save.failed)} stories failed`);
      ui.list([
        `Fetching pages: ${summary.fetchStoryPages.succeeded}/${summary.fetchStoryPages.total} succeeded, ${summary.fetchStoryPages.failed} failed.`,
        `Fetching stories: ${summary.fetchStories.succeeded}/${summary.fetchStories.total} succeeded, ${summary.fetchStories.failed} failed.`,
        `Saving stories: ${summary.save.succeeded}/${summary.save.total} succeeded, ${summary.save.failed} failed.`,
      ]);

      reporter.addSummary('fetchStoryPagesResults', summary.fetchStoryPages);
      reporter.addSummary('fetchStoriesResults', summary.fetchStories);
      reporter.addSummary('saveResults', summary.save);
      reporter.finalize();
    }
  });
