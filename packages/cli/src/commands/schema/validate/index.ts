import { colorPalette, commands } from '../../../constants';
import { handleError, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { schemaCommand } from '../command';
import type { LevelOption, ValidationRunResult } from '../../../utils/validation';
import {
  countIssues,
  formatPretty,
  groupIssuesByEntity,
  loadSchemaEntry,
  parseLevel,
  validateSchema,
  writeValidationReport,
} from '../../../utils/validation';

interface SchemaValidateOptions {
  level: LevelOption;
}

schemaCommand
  .command('validate <entry-file>')
  .description('Validate a local TypeScript schema definition. Static and fully offline — no login, no space, no API calls.')
  .option('--level <level>', 'Display threshold: error|warning', parseLevel, 'warning')
  .action(async (entryFile: string, options: SchemaValidateOptions, command) => {
    const { level } = options;
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { verbose } = command.optsWithGlobals();

    logger.info('Schema validate started', { entryFile, level });

    try {
      // 1. Load the schema entry file. A missing/empty/unresolvable file is fatal.
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

      // 2. Validate and group issues by entity.
      const { issues } = await validateSchema(loaded.schema);
      const result: ValidationRunResult = {
        unitNoun: 'entities',
        unitsTotal: loaded.entityCount,
        groups: groupIssuesByEntity(issues),
      };

      // 3. Render.
      ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Validating schema...');
      ui.log(formatPretty(result, level));

      // 4. Report and set the exit code.
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
