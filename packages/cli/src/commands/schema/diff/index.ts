import { colorPalette, commands } from '../../../constants';
import { handleError, requireAuthentication, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { schemaCommand } from '../command';
import { diffSchema } from '../diff-schema';
import type { SchemaDiffReport } from './actions';
import { buildDiffReport, formatSchemaDiff, isSpaceRef, resolveSource } from './actions';

schemaCommand
  .command('diff')
  .description('Diff two schemas (space IDs or local entry files) and report what changed')
  .requiredOption('--from <source>', 'Base schema to compare against: a space ID or a path to a schema entry file')
  .requiredOption('--to <source>', 'Target schema: a space ID or a path to a schema entry file')
  .action(async (options: { from: string; to: string }, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { verbose } = command.optsWithGlobals();
    const { state } = session();
    const { from, to } = options;

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Diffing schema...');
    logger.info('Schema diff started', { from, to });

    // Authentication is only required when a side points at a remote space.
    if ((isSpaceRef(from) || isSpaceRef(to)) && !requireAuthentication(state, verbose)) { return; }

    const summary = { total: 0, succeeded: 0, failed: 0 };
    let report: SchemaDiffReport | undefined;

    try {
      const resolveSpinner = ui.createSpinner('Resolving schemas...');
      let fromSchema: Awaited<ReturnType<typeof resolveSource>>;
      let toSchema: Awaited<ReturnType<typeof resolveSource>>;
      try {
        [fromSchema, toSchema] = await Promise.all([resolveSource(from), resolveSource(to)]);
      }
      catch (maybeError) {
        resolveSpinner.failed('Failed to resolve schemas');
        handleError(toError(maybeError), verbose);
        return;
      }
      resolveSpinner.succeed('Schemas resolved');

      // Group UUIDs are per-space identifiers, so they are meaningless to
      // compare against a remote space. Only diff them when both sides are local
      // files, where an explicit `component_group_uuid` is a deliberate choice.
      const compareGroupUuid = !isSpaceRef(from) && !isSpaceRef(to);
      const diffResult = diffSchema(fromSchema, toSchema, { compareGroupUuid });
      report = buildDiffReport(diffResult, from, to);

      ui.br();
      ui.log(formatSchemaDiff(diffResult, from, to));

      summary.total = diffResult.diffs.length;
      summary.succeeded = summary.total;
    }
    catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    }
    finally {
      logger.info('Schema diff finished', { summary });
      reporter.addSummary('schemaDiffResults', summary);
      // The full structured diff travels in the report's meta — the machine-readable
      // "diff file" downstream space-to-space tooling reads (enabled via --report-enabled).
      if (report) { reporter.addMeta('diff', report); }
      reporter.finalize();
    }
  });
