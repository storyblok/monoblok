import { confirm, select } from '@inquirer/prompts';
import { basename } from 'pathe';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { resolvePath } from '../../../utils/filesystem';
import { schemaCommand } from '../command';
import { fetchRemoteSchema } from '../push/actions';
import { saveChangeset } from '../push/changeset';
import type { SchemaRollbackOptions } from './constants';
import { buildRollbackOps, executeRollback, formatRollbackOutput, listChangesets, loadChangeset } from './actions';

schemaCommand
  .command('rollback [changeset-file]')
  .description('Roll back a Storyblok space to the state captured in a changeset')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage')
  .option('--dry-run', 'Show what would be undone without applying changes', false)
  .option('--yes', 'Skip confirmation prompt', false)
  .option('--latest', 'Automatically select the most recent changeset', false)
  .action(async (changesetFile: string | undefined, options: SchemaRollbackOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Rolling back schema...');
    logger.info('Schema rollback started', { changesetFile, space });

    if (!requireAuthentication(state, verbose)) { return; }

    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space SPACE_ID.'), verbose);
      return;
    }

    const summary = { total: 0, succeeded: 0, failed: 0 };

    try {
      // 1. Resolve changeset file
      const resolvedBase = resolvePath(basePath, '');
      let resolvedFile: string;

      if (changesetFile) {
        resolvedFile = changesetFile;
      }
      else if (options.latest) {
        const available = await listChangesets(resolvedBase);
        if (available.length === 0) {
          ui.warn('No changesets found. Run `schema push` first to create one.');
          return;
        }
        resolvedFile = available[0];
        ui.info(`Using latest changeset: ${basename(resolvedFile)}`);
      }
      else {
        const available = await listChangesets(resolvedBase);
        if (available.length === 0) {
          ui.warn('No changesets found. Run `schema push` first to create one.');
          return;
        }
        resolvedFile = await select({
          message: 'Select a changeset to roll back:',
          choices: available.map(f => ({ name: basename(f), value: f })),
        });
      }

      // 2. Load changeset
      let changeset;
      try {
        changeset = await loadChangeset(resolvedFile);
      }
      catch (maybeError) {
        handleError(toError(maybeError), verbose);
        return;
      }

      logger.info('Changeset loaded', { file: resolvedFile, changes: changeset.changes.length });

      // 3. Build rollback ops
      const ops = buildRollbackOps(changeset);

      if (ops.length === 0) {
        ui.ok('Changeset has no changes — nothing to roll back.');
        return;
      }

      // 4. Display diff
      ui.br();
      ui.log(formatRollbackOutput(changeset.changes));

      // 5. Dry run stops here
      if (options.dryRun) {
        ui.info('Dry run — no changes applied.');
        logger.info('Dry run completed', { ops: ops.length });
        return;
      }

      // 6. Confirm (unless --yes)
      if (!options.yes) {
        const confirmed = await confirm({
          message: `Apply rollback of ${ops.length} change(s) from ${basename(resolvedFile)}?`,
          default: false,
        });
        if (!confirmed) {
          ui.info('Rollback cancelled.');
          return;
        }
      }

      // 7. Fetch current remote state (needed for entity IDs)
      const remoteSpinner = ui.createSpinner(`Fetching current remote state from space ${space}...`);
      let remoteResult;
      try {
        remoteResult = await fetchRemoteSchema(space);
      }
      catch (maybeError) {
        remoteSpinner.failed('Failed to fetch remote schema');
        handleError(toError(maybeError), verbose);
        return;
      }
      const { remote } = remoteResult;
      remoteSpinner.succeed(`Remote: ${remote.components.size} components, ${remote.componentFolders.size} component folders, ${remote.datasources.size} datasources`);

      // 8. Execute rollback
      const rollbackSpinner = ui.createSpinner('Applying rollback...');
      const result = await executeRollback(space, ops, remote);

      summary.total = result.created + result.updated + result.deleted;
      summary.succeeded = summary.total;

      rollbackSpinner.succeed(`Rolled back: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted.`);

      // 9. Save rollback changeset
      const timestamp = new Date().toISOString();
      const rollbackChangesetPath = await saveChangeset(resolvedBase, {
        timestamp,
        spaceId: Number(space),
        remote: { components: remoteResult.rawComponents, componentFolders: remoteResult.rawComponentFolders, datasources: remoteResult.rawDatasources },
        changes: ops.map(op => ({
          type: op.type,
          name: op.name,
          action: op.action,
          ...(Object.keys(op.payload).length > 0 && { after: op.payload }),
        })),
      });
      logger.info('Rollback changeset saved', { path: rollbackChangesetPath });
    }
    catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    }
    finally {
      logger.info('Schema rollback finished', { summary });
      reporter.addSummary('schemaRollbackResults', summary);
      reporter.finalize();
    }
  });
