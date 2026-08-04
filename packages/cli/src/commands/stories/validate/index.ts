import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Story } from '../constants';
import { normalizeStartsWith } from '../constants';
import { colorPalette, commands } from '../../../constants';
import { session } from '../../../session';
import { storiesCommand } from '../command';
import type { ProgressBar } from '../../../lib/ui';
import { getUI } from '../../../lib/ui';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { fetchStoriesStream, fetchStoryStream } from '../streams';
import { requireAuthentication } from '../../../utils/auth';
import { handleError, toError } from '../../../utils/error/error';
import { CommandError } from '../../../utils/error/command-error';
import type { FormatOption, LevelOption, SchemaLike, ValidationGroup, ValidationGroupRef, ValidationRunResult } from '../../../utils/validation';
import {
  countIssues,
  formatJson,
  formatPretty,
  loadSchemaEntry,
  parseFormat,
  parseLevel,
  validateStory,
  writeValidationReport,
} from '../../../utils/validation';

interface StoriesValidateOptions {
  schema?: string;
  startsWith?: string;
  level: string;
  format: string;
}

/** Human-readable heading for a story group, e.g. `app/home (story #123456)`. */
function storyHeader(story: Story): string {
  const slug = story.full_slug ?? story.slug ?? String(story.id);
  return `${slug} (story #${story.id})`;
}

/** Machine-readable identity for a story group, so a consumer never parses the header. */
function storyRef(story: Story): ValidationGroupRef {
  return {
    kind: 'story',
    id: story.id,
    ...(story.full_slug ? { slug: story.full_slug } : {}),
    ...(story.name ? { name: story.name } : {}),
  };
}

storiesCommand
  .command('validate')
  .description('Validate every story\'s draft content in a space against a local code-defined schema.')
  .option('-s, --space <space>', 'space ID')
  .option('--schema <entry-file>', 'Path to the TypeScript schema entry file')
  .option('--starts-with <path>', 'Only validate stories whose path starts with this prefix. Example: --starts-with="en/blog/"')
  .option('--level <level>', 'Display threshold: error|warning', 'warning')
  .option('--format <format>', 'Output format: pretty|json', 'pretty')
  .action(async (options: StoriesValidateOptions, command) => {
    const { schema: schemaEntry } = options;
    // A leading slash would make `starts_with` match nothing; `/` alone leaves no
    // prefix at all, which is the same as not filtering.
    const startsWith = options.startsWith === undefined
      ? undefined
      : normalizeStartsWith(options.startsWith) || undefined;
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

    try {
      // 1. Preconditions (fatal — exit 2).
      let level: LevelOption;
      let format: FormatOption;
      try {
        level = parseLevel(options.level);
        format = parseFormat(options.format);
      }
      catch (maybeError) {
        failFatal(toError(maybeError).message);
        return;
      }

      const isJson = format === 'json';
      logger.info('Stories validate started', { space, schemaEntry, startsWith, level, format });

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
        // Story content cannot be validated without block definitions, so an
        // entry file with none is a bad invocation rather than a clean run.
        ({ schema } = await loadSchemaEntry(schemaEntry, { requireBlocks: true }));
      }
      catch (maybeError) {
        failFatal(toError(maybeError).message);
        return;
      }

      // 3. Fetch every non-folder story and validate its content.
      const groups: ValidationGroup[] = [];
      let totalStories = 0;
      const fetchErrors: NonNullable<ValidationRunResult['fetchErrors']> = [];
      let listFailed = false;
      let listError: string | undefined;

      // The progress bar draws on stdout: skip it for JSON so the document stays
      // pure, and create it only once there is something to count so a run that
      // never lists a story does not leave an empty bar behind its error output.
      let progress: ProgressBar | undefined;
      let listedTotal = 0;
      let foldersSkipped = 0;
      const startProgress = (): ProgressBar | undefined => {
        if (isJson) {
          return undefined;
        }
        progress ??= ui.createProgressBar({ title: 'Validating Stories...'.padEnd(23) });
        return progress;
      };
      // The list `Total` header counts folders too, and is re-reported on every
      // page, so the bar's total is recomputed from both numbers rather than
      // adjusted in place. Keeps the bar counting the same population the summary
      // reports instead of finishing one short per folder.
      const syncProgressTotal = () => {
        const total = Math.max(listedTotal - foldersSkipped, 0);
        // Nothing to count yet, so do not bring a bar into existence: a filter
        // that matched nothing would otherwise leave an empty `0/1` bar sitting
        // above the warning that says nothing was validated.
        if (total === 0 && progress === undefined) {
          return;
        }
        startProgress()?.setTotal(total);
      };
      const stopProgress = () => {
        progress?.stop();
        ui.stopAllProgressBars();
      };

      if (!isJson) {
        ui.title(`${commands.STORIES}`, colorPalette.STORIES, 'Validating stories...');
      }

      try {
        await pipeline(
          fetchStoriesStream({
            spaceId: space,
            params: { starts_with: startsWith },
            setTotalStories: (total) => {
              listedTotal = total;
              syncProgressTotal();
            },
            onPageError: (error, page, total) => {
              // A failure listing stories is fatal — we cannot validate a partial space.
              listFailed = true;
              listError = error.message;
              // Leave no live bar redrawing itself underneath the error output.
              stopProgress();
              logger.error('Failed to list stories', { error: error.message, page, total });
              handleError(error, verbose, { page, total });
            },
          }),
          // Skip folders: they carry no content to validate, and are not part of
          // the population the summary counts.
          new Transform({
            objectMode: true,
            transform(story: Story, _encoding, callback) {
              if (story.is_folder) {
                foldersSkipped += 1;
                syncProgressTotal();
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
              fetchErrors.push({
                id: story.id,
                ...(story.full_slug ? { slug: story.full_slug } : {}),
                message: error.message,
              });
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
                  groups.push({ header: storyHeader(story), ref: storyRef(story), issues });
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
        stopProgress();
        failFatal(toError(maybeError).message);
        return;
      }

      stopProgress();

      // Stories arrive in completion order, not list order, so identical content
      // would print in a different order on every run. Sort by path to keep the
      // output diffable in CI. Compared as plain strings rather than with
      // `localeCompare`, whose result depends on the runtime's default locale and
      // ICU build: two CI runners with a different `LANG` would order the same
      // slugs differently, which is the opposite of diffable. These are slugs,
      // not display names, so there is no human collation worth preserving.
      groups.sort((a, b) => {
        const left = a.ref.slug ?? a.header;
        const right = b.ref.slug ?? b.header;
        if (left !== right) {
          return left < right ? -1 : 1;
        }
        return (a.ref.id ?? 0) - (b.ref.id ?? 0);
      });

      // 4. Build the result. The run-level failures travel with it so neither
      //    formatter can present an incomplete run as a clean one.
      const fetchFailures = fetchErrors.length;
      const result: ValidationRunResult = {
        unitNoun: 'stories',
        unitNounSingular: 'story',
        unitsTotal: totalStories,
        groups,
        // Travels with the result so both formatters can say the population was
        // narrowed, rather than only the pretty one knowing.
        ...(startsWith === undefined ? {} : { filter: { option: '--starts-with', value: startsWith } }),
        fetchFailures,
        fetchErrors,
        listFailed,
        listError,
      };

      // 5. Report. The artifact carries the run-level fetch/list failures so an
      //    incomplete run is never recorded as success.
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

      // 6. Render and set the exit code. A failed listing means the run never
      //    had a population to validate, so it reports as fatal rather than
      //    printing a clean summary over an incomplete run.
      if (isJson) {
        ui.writeMachineOutput(formatJson(result, level));
      }

      if (listFailed) {
        if (!isJson) {
          ui.error('Listing stories failed; the space was not fully validated.');
        }
        process.exitCode = 2;
        return;
      }

      if (!isJson) {
        ui.log(formatPretty(result, level));
        // A prefix that selects nothing produces the same green summary as a
        // clean space. Say so, or the run reads as a pass over content it never
        // looked at.
        if (result.filter && totalStories === 0) {
          ui.warn(`No stories matched ${result.filter.option} "${result.filter.value}"; nothing was validated.`);
        }
        if (fetchFailures > 0) {
          ui.warn(`${fetchFailures} story(s) could not be fetched and were not validated.`);
        }
      }

      process.exitCode = errors > 0 || fetchFailures > 0 ? 1 : 0;
    }
    finally {
      // Always write the report artifact, including on every fatal early return.
      reporter.finalize();
    }
  });
