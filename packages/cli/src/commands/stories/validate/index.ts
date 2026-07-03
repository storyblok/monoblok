import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Story } from '../constants';
import { colorPalette, commands } from '../../../constants';
import { session } from '../../../session';
import { storiesCommand } from '../command';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { fetchStoriesStream, fetchStoryStream } from '../streams';
import { requireAuthentication } from '../../../utils/auth';
import { handleError, toError } from '../../../utils/error/error';
import { CommandError } from '../../../utils/error/command-error';
import type { LevelOption, SchemaLike, ValidationGroup, ValidationRunResult } from '../../../utils/validation';
import {
  countIssues,
  formatPretty,
  loadSchemaEntry,
  parseLevel,
  validateStory,
  writeValidationReport,
} from '../../../utils/validation';

interface StoriesValidateOptions {
  schema?: string;
  startsWith?: string;
  level: LevelOption;
}

/** Human-readable heading for a story group, e.g. `app/home (story #123456)`. */
function storyHeader(story: Story): string {
  const slug = story.full_slug ?? story.slug ?? String(story.id);
  return `${slug} (story #${story.id})`;
}

storiesCommand
  .command('validate')
  .description('Validate every story\'s content in a space against a local code-defined schema.')
  .option('-s, --space <space>', 'space ID')
  .option('--schema <entry-file>', 'Path to the TypeScript schema entry file')
  .option('--starts-with <path>', 'Only validate stories whose path starts with this prefix. Example: --starts-with="/en/blog/"')
  .option('--level <level>', 'Display threshold: error|warning', parseLevel, 'warning')
  .action(async (options: StoriesValidateOptions, command) => {
    const { schema: schemaEntry, startsWith, level } = options;
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, verbose } = command.optsWithGlobals();
    const { state } = session();

    const failFatal = (message: string): void => {
      // Record a failure so the report reflects the aborted run, not SUCCESS.
      reporter.addSummary('validation', { total: 1, succeeded: 0, failed: 1 });
      handleError(new CommandError(message), verbose);
      process.exitCode = 2;
    };

    logger.info('Stories validate started', { space, schemaEntry, startsWith, level });

    try {
      // 1. Preconditions (fatal — exit 2).
      if (!requireAuthentication(state, verbose)) {
        reporter.addSummary('validation', { total: 1, succeeded: 0, failed: 1 });
        process.exitCode = 2;
        return;
      }
      if (!space) {
        failFatal('Please provide the space as argument --space YOUR_SPACE_ID.');
        return;
      }
      if (!schemaEntry) {
        failFatal('Please provide the schema entry file with --schema <entry-file>.');
        return;
      }

      // 2. Load the schema (fatal on bad/empty/unresolvable entry file — exit 2).
      let schema: SchemaLike;
      try {
        ({ schema } = await loadSchemaEntry(schemaEntry));
      }
      catch (maybeError) {
        failFatal(toError(maybeError).message);
        return;
      }

      // 3. Fetch every non-folder story and validate its content.
      const groups: ValidationGroup[] = [];
      let totalStories = 0;
      let fetchFailures = 0;
      let listFailed = false;

      const progress = ui.createProgressBar({ title: 'Validating Stories...'.padEnd(23) });

      ui.title(`${commands.STORIES}`, colorPalette.STORIES, 'Validating stories...');

      try {
        await pipeline(
          fetchStoriesStream({
            spaceId: space,
            params: { starts_with: startsWith },
            // The list `Total` header counts folders too; folders are increment-
            // ed as they are skipped below so the bar still reaches 100%.
            setTotalStories: total => progress?.setTotal(total),
            onPageError: (error, page, total) => {
              // A failure listing stories is fatal — we cannot validate a partial space.
              listFailed = true;
              logger.error('Failed to list stories', { error: error.message, page, total });
              handleError(error, verbose, { page, total });
            },
          }),
          // Skip folders: they carry no content to validate. Still advance the
          // progress bar so its folder-inclusive total completes.
          new Transform({
            objectMode: true,
            transform(story: Story, _encoding, callback) {
              if (story.is_folder) {
                progress?.increment();
                callback();
                return;
              }
              totalStories += 1;
              this.push(story);
              callback();
            },
          }),
          fetchStoryStream({
            spaceId: space,
            onStoryError: (error, story) => {
              fetchFailures += 1;
              progress?.increment();
              logger.error('Failed to fetch story', { error: error.message, storyId: story.id });
              handleError(error, verbose, { storyId: story.id });
            },
          }),
          new Writable({
            objectMode: true,
            async write(story: Story, _encoding, callback) {
              try {
                const { issues } = await validateStory(story, schema);
                if (issues.length > 0) {
                  groups.push({ header: storyHeader(story), issues });
                }
                progress?.increment();
                callback();
              }
              catch (maybeError) {
                // Validation is not expected to throw; treat it as fatal rather
                // than letting the stream hang on a missing callback.
                callback(toError(maybeError));
              }
            },
          }),
        );
      }
      catch (maybeError) {
        // An unexpected pipeline failure (e.g. the network is down) is fatal.
        progress?.stop();
        ui.stopAllProgressBars();
        failFatal(toError(maybeError).message);
        return;
      }

      progress?.stop();
      ui.stopAllProgressBars();

      // 4. Build the result and render.
      const result: ValidationRunResult = {
        unitNoun: 'stories',
        unitsTotal: totalStories,
        groups,
      };

      ui.log(formatPretty(result, level));
      if (fetchFailures > 0) {
        ui.warn(`${fetchFailures} story(s) could not be fetched and were not validated.`);
      }

      // 5. Report and set the exit code. The report artifact carries the run-level
      // fetch/list failures so an incomplete run is never recorded as success.
      writeValidationReport(reporter, result);
      reporter.addSummary('fetch', {
        total: totalStories,
        succeeded: totalStories - fetchFailures,
        failed: fetchFailures,
      });
      if (listFailed) {
        // Mark the run failed in the report even when no story had issues.
        reporter.addSummary('list', { total: 1, succeeded: 0, failed: 1 });
      }

      const { errors, warnings } = countIssues(result);
      logger.info('Stories validate finished', { errors, warnings, stories: totalStories, fetchFailures, listFailed });

      if (listFailed) {
        process.exitCode = 2;
      }
      else if (errors > 0 || fetchFailures > 0) {
        process.exitCode = 1;
      }
      else {
        process.exitCode = 0;
      }
    }
    finally {
      // Always write the report artifact, including on every fatal early return.
      reporter.finalize();
    }
  });
