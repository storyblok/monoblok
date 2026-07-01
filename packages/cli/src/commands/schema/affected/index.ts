import { colorPalette, commands, directories } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { fileExists, resolveCommandPath } from '../../../utils/filesystem';
import { schemaCommand } from '../command';
import type { SchemaData } from '../types';
import { loadSchema } from '../load-schema';
import { diffSchema } from '../diff-schema';
import { fetchRemoteSchema } from '../actions';
import { analyzeBreakingChanges } from '../migrations/analyze';
import { toSchemaLike } from '../to-schema-like';
import type { SchemaAffectedOptions } from './constants';
import {
  aggregate,
  analyzeLocalStories,
  analyzeRemoteStories,
  computeImpactedComponents,
} from './actions';
import { formatSummary } from './format';

schemaCommand
  .command('affected <entry-file>')
  .alias('impact')
  .description('Report which stories a schema change affects and which would break')
  .option('-s, --space <space>', 'space ID')
  .option('--local', 'analyze locally pulled stories instead of fetching from the space', false)
  .option('--include-deleted', 'treat remote-only components as deleted (mirrors `schema push --delete`)', false)
  .option('--fail-on-break', 'exit with a non-zero code when any story would break (for CI gating)', false)
  .action(async (entryFile: string, options: SchemaAffectedOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Analyzing schema impact...');
    logger.info('Schema affected started', { entryFile, space });

    if (!requireAuthentication(state, verbose)) { return; }

    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space SPACE_ID.'), verbose);
      return;
    }

    try {
      // 1. Load local schema
      const loadSpinner = ui.createSpinner('Resolving schema...');
      let local: SchemaData;
      try {
        local = await loadSchema(entryFile);
      }
      catch (maybeError) {
        loadSpinner.failed('Failed to resolve schema');
        handleError(toError(maybeError), verbose);
        return;
      }
      loadSpinner.succeed(`Found: ${local.components.length} components, ${local.datasources.length} datasources`);

      // 2. Fetch remote state
      const remoteSpinner = ui.createSpinner(`Fetching remote state from space ${space}...`);
      let remoteResult: Awaited<ReturnType<typeof fetchRemoteSchema>>;
      try {
        remoteResult = await fetchRemoteSchema(space);
      }
      catch (maybeError) {
        remoteSpinner.failed('Failed to fetch remote schema');
        handleError(toError(maybeError), verbose);
        return;
      }
      const { remote, rawComponents } = remoteResult;
      remoteSpinner.succeed(`Remote: ${remote.components.size} components, ${remote.datasources.size} datasources`);

      // 3. Diff + breaking-change analysis
      const diffResult = diffSchema(local, remote);
      const breakingChanges = analyzeBreakingChanges(diffResult, local, remote);

      // 4. Determine impacted components
      const impacted = computeImpactedComponents(diffResult, breakingChanges, {
        withDelete: options.includeDeleted,
      });

      if (impacted.size === 0) {
        ui.br();
        ui.ok('No content-affecting schema changes detected.');
        reporter.addSummary('schemaAffectedResults', { total: 0, succeeded: 0, failed: 0 });
        return;
      }

      // 5. Analyze stories that use impacted components. Breakage is validated
      // against both schemas so only errors the change introduces are counted.
      const oldSchema = toSchemaLike(rawComponents);
      const newSchema = toSchemaLike(local.components);

      // `--local` reads pulled stories from the default directory; fail early with
      // actionable guidance when it is missing rather than surfacing a raw fs error.
      const storiesPath = options.local
        ? resolveCommandPath(directories.stories, space, basePath)
        : undefined;
      if (storiesPath && !(await fileExists(storiesPath))) {
        handleError(
          new CommandError(`No local stories found at ${storiesPath}. Run \`storyblok stories pull --space ${space}\` first.`),
          verbose,
        );
        return;
      }

      const progress = ui.createProgressBar({ title: 'Analyzing stories' });
      let fetchErrors = 0;
      const hooks = {
        onTotal: (total: number) => progress.setTotal(total),
        onStory: () => progress.increment(),
        onStoryError: (error: Error, storyRef?: string) => {
          fetchErrors += 1;
          logger.warn('Failed to fetch story for impact analysis', { story: storyRef, error: error.message });
        },
      };

      const stories = storiesPath
        ? await analyzeLocalStories(storiesPath, impacted, oldSchema, newSchema, hooks)
        : await analyzeRemoteStories(space, impacted, oldSchema, newSchema, hooks);
      progress.stop();

      if (fetchErrors > 0) {
        ui.warn(`${fetchErrors} story(s) could not be fetched and were skipped. Re-run with --verbose for details.`);
      }

      // 6. Aggregate + report
      const report = aggregate(space, impacted, stories);

      ui.br();
      for (const line of formatSummary(report)) {
        ui.log(line);
      }

      // The full per-story/per-field detail rides along in the standard report
      // file (`--report-enabled`, on by default); there is no bespoke JSON flag.
      reporter.addMeta('schemaAffected', report);
      reporter.addSummary('schemaAffectedResults', {
        total: report.totals.usedStories,
        succeeded: report.totals.usedStories - report.totals.brokenStories,
        failed: report.totals.brokenStories,
      });
      logger.info('Schema affected finished', { totals: report.totals });

      // Opt-in CI gate: surface breaking impact as a non-zero exit code.
      if (options.failOnBreak && report.totals.brokenStories > 0) {
        process.exitCode = 1;
      }
    }
    catch (maybeError) {
      handleError(toError(maybeError), verbose);
    }
    finally {
      reporter.finalize();
    }
  });
