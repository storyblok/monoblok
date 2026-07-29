import { readdir } from 'node:fs/promises';
import { Option } from 'commander';
import { resolve } from 'pathe';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { schemaCommand } from '../command';
import { displayPath } from '../utils';
import { createSecretNameMatcher, DEFAULT_SECRET_NAMES } from '../secrets';
import type { SchemaInitOptions } from './constants';
import { fetchRemoteSchema } from '../actions';
import { writeSchemaFiles } from './actions';

/** Parses a comma-separated `--secret-names` value into a trimmed, non-empty list. */
function parseSecretNames(value: string): string[] {
  return value.split(',').map(name => name.trim()).filter(Boolean);
}

async function isTargetEmpty(targetPath: string): Promise<boolean> {
  try {
    const entries = await readdir(targetPath);
    return entries.every(entry => entry.startsWith('.'));
  }
  catch (maybeError) {
    const error = maybeError as NodeJS.ErrnoException;
    if (error?.code === 'ENOENT') { return true; }
    throw error;
  }
}

schemaCommand
  .command('init')
  .description('Initialize a local code-driven schema workspace from an existing Storyblok space (one-time bootstrap)')
  .option('-s, --space <space>', 'space ID')
  .option('--out-dir <dir>', 'Output directory for generated bootstrap files', '.storyblok/schema')
  .option(
    '--secret-names <names>',
    `Comma-separated plugin option names to redact as \`secret()\` (added to the defaults: ${DEFAULT_SECRET_NAMES.join(', ')})`,
    parseSecretNames,
  )
  .addOption(new Option('--no-redact-secrets', 'Do not redact sensitive plugin option values (write them verbatim)'))
  .action(async (options: SchemaInitOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Initializing schema...');
    logger.info('Schema init started', { space });

    if (!requireAuthentication(state, verbose)) { return; }

    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space SPACE_ID.'), verbose);
      return;
    }

    const targetPath = resolve(options.outDir);
    const targetDisplayPath = displayPath(targetPath, options.outDir);

    if (!(await isTargetEmpty(targetPath))) {
      handleError(
        new CommandError(`Target directory ${targetDisplayPath} is not empty. \`schema init\` is a one-time bootstrap and refuses to overwrite existing files. Use \`schema push\` for ongoing changes, or remove the directory to re-bootstrap.`),
        verbose,
      );
      return;
    }

    const summary = { total: 0, succeeded: 0, failed: 0 };

    try {
      // 1. Fetch remote state
      const fetchSpinner = ui.createSpinner(`Fetching schema from space ${space}...`);
      let fetchResult: Awaited<ReturnType<typeof fetchRemoteSchema>>;
      try {
        fetchResult = await fetchRemoteSchema(space);
      }
      catch (maybeError) {
        fetchSpinner.failed('Failed to fetch remote schema');
        handleError(toError(maybeError), verbose);
        return;
      }
      const { rawComponents, rawComponentFolders, rawDatasources } = fetchResult;
      fetchSpinner.succeed(`Found: ${rawComponents.length} components, ${rawComponentFolders.length} component folders, ${rawDatasources.length} datasources`);

      // 2. Generate and write files. Sensitive field-config values are redacted
      //    to `secret()` placeholders unless `--no-redact-secrets` is set.
      const secretNameMatcher = options.redactSecrets
        ? createSecretNameMatcher([...DEFAULT_SECRET_NAMES, ...(options.secretNames ?? [])])
        : undefined;

      const writeSpinner = ui.createSpinner(`Generating TypeScript files to ${targetDisplayPath}...`);
      const writtenFiles = await writeSchemaFiles(targetPath, rawComponents, rawComponentFolders, rawDatasources, secretNameMatcher);

      summary.total = writtenFiles.length;
      summary.succeeded = writtenFiles.length;

      writeSpinner.succeed(`Generated ${writtenFiles.length} files`);
      ui.list(writtenFiles.map(file => displayPath(file, options.outDir)));
      ui.warn('`schema init` is a one-time bootstrap step for adopting an existing space. Review generated files before continuing.');
      if (secretNameMatcher) {
        ui.info('Sensitive plugin option values were replaced with `secret()` placeholders. `schema push` restores them from the space (or from `secret(\'ENV_VAR\')`). Review before committing.');
      }
      else {
        ui.warn('Secret redaction is disabled (`--no-redact-secrets`): generated files may contain sensitive values. Review before committing.');
      }
      ui.info('After bootstrapping, keep your local schema as the source of truth and use `schema push` for ongoing changes.');
      ui.info('Make sure `@storyblok/schema` is installed in the project that imports these files (e.g. `pnpm add @storyblok/schema`).');
    }
    catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    }
    finally {
      logger.info('Schema init finished', { summary });
      reporter.addSummary('schemaInitResults', summary);
      reporter.finalize();
    }
  });
