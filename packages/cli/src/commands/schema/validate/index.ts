import { colorPalette, commands } from '../../../constants';
import { handleError, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../lib/ui';
import { schemaCommand } from '../command';
import type { FormatOption, LevelOption, ValidationRunResult } from '../../../utils/validation';
import {
  countIssues,
  formatJson,
  formatPretty,
  groupIssuesByEntity,
  loadSchemaEntry,
  parseFormat,
  parseLevel,
  validateSchema,
  writeValidationReport,
} from '../../../utils/validation';

interface SchemaValidateOptions {
  level: string;
  format: string;
}

schemaCommand
  .command('validate <entry-file>')
  .description('Validate a local TypeScript schema definition. Static and fully offline — no login, no space, no API calls.')
  .option('--level <level>', 'Display threshold: error|warning', 'warning')
  .option('--format <format>', 'Output format: pretty|json', 'pretty')
  .action(async (entryFile: string, options: SchemaValidateOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { verbose } = command.optsWithGlobals();

    try {
      // 1. Parse the display options. An invalid value is fatal (exit 2), like
      //    the other bad-invocation paths.
      let level: LevelOption;
      let format: FormatOption;
      try {
        level = parseLevel(options.level);
        format = parseFormat(options.format);
      }
      catch (maybeError) {
        reporter.addSummary('validation', { total: 1, succeeded: 0, failed: 1 });
        handleError(toError(maybeError), verbose);
        process.exitCode = 2;
        return;
      }

      const isJson = format === 'json';
      logger.info('Schema validate started', { entryFile, level, format });

      // 2. Load the schema entry file. A missing/empty/unresolvable file is fatal.
      let loaded: Awaited<ReturnType<typeof loadSchemaEntry>>;
      try {
        loaded = await loadSchemaEntry(entryFile);
      }
      catch (maybeError) {
        const error = toError(maybeError);
        // Record a failure so the report reflects the aborted run, not SUCCESS.
        reporter.addSummary('validation', { total: 1, succeeded: 0, failed: 1 });
        handleError(error, verbose);
        logger.error('Schema validate failed to load entry file', { error: error.message });
        process.exitCode = 2;
        return;
      }

      // 3. Validate and group issues by entity.
      const { issues } = await validateSchema(loaded.schema);
      const result: ValidationRunResult = {
        unitNoun: 'entities',
        unitsTotal: loaded.entityCount,
        groups: groupIssuesByEntity(issues),
      };

      // 4. Render. JSON goes to stdout as the only output so it stays pipeable.
      if (isJson) {
        ui.writeMachineOutput(formatJson(result, level));
      }
      else {
        ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Validating schema...');
        ui.log(formatPretty(result, level));
      }

      // 5. Report and set the exit code.
      writeValidationReport(reporter, result);

      const { errors, warnings } = countIssues(result);
      logger.info('Schema validate finished', { errors, warnings, entities: result.unitsTotal });
      process.exitCode = errors > 0 ? 1 : 0;
    }
    finally {
      // Always write the report artifact, including on the fatal early return.
      reporter.finalize();
    }
  });
