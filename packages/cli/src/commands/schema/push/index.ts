import { confirm } from '@inquirer/prompts';
import { Option } from 'commander';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { getLogger } from '../../../lib/logger/logger';
import { getReporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { session } from '../../../session';
import { resolvePath } from '../../../utils/filesystem';
import { schemaCommand } from '../command';
import type { SchemaPushOptions } from './constants';
import type { SchemaData } from '../types';
import { loadSchema } from './load-schema';
import { diffSchema } from './diff-schema';
import { buildChangesetEntries, executePush, fetchRemoteSchema, formatDiffOutput } from './actions';
import { resolveFolderReferences } from './resolve-folders';
import { saveChangeset } from './changeset';
import { analyzeBreakingChanges } from './migrations/analyze';
import { renderMigrationCode, writeMigrationFile } from './migrations/generate';

schemaCommand
  .command('push <entry-file>')
  .description('Push local TypeScript schema and datasource definitions to a Storyblok space')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage')
  .option('--dry-run', 'Show diffs without applying changes', false)
  .option('--delete', 'Delete remote entities not present in local schema', false)
  .option('--migrations', 'Generate scaffold migration files for breaking changes', true)
  .addOption(new Option('--no-migrations', 'Skip migration generation for breaking changes'))
  .action(async (entryFile: string, options: SchemaPushOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, 'Pushing schema...');
    logger.info('Schema push started', { entryFile, space });

    if (!requireAuthentication(state, verbose)) { return; }

    if (!space) {
      handleError(new CommandError('Please provide the space as argument --space SPACE_ID.'), verbose);
      return;
    }

    const summary = { total: 0, succeeded: 0, failed: 0 };

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
      loadSpinner.succeed(`Found: ${local.components.length} components, ${local.componentFolders.length} component folders, ${local.datasources.length} datasources`);

      const totalLocal = local.components.length + local.componentFolders.length + local.datasources.length;
      if (totalLocal === 0) {
        ui.warn('No components, folders, or datasources found in the entry file. Verify the file exports schema definitions.');
        return;
      }

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
      const { remote, rawComponents, rawComponentFolders, rawDatasources } = remoteResult;
      remoteSpinner.succeed(`Remote: ${remote.components.size} components, ${remote.componentFolders.size} component folders, ${remote.datasources.size} datasources`);

      // 3. Resolve local folder UUIDs to remote UUIDs
      const { resolved, pendingFolderAssignments } = resolveFolderReferences(local, remote);

      // 4. Diff
      const diffResult = diffSchema(resolved, remote);

      // 5. Display diffs
      ui.br();
      ui.log(formatDiffOutput(diffResult, { delete: options.delete }));

      // 6. Analyze breaking changes and offer migration generation
      if (options.migrations) {
        const breakingChanges = analyzeBreakingChanges(diffResult, resolved, remote);

        if (breakingChanges.length > 0) {
          const totalChanges = breakingChanges.reduce((sum, c) => sum + c.changes.length, 0);
          ui.br();
          ui.warn(`${totalChanges} breaking change(s) detected in ${breakingChanges.length} component(s).`);
          ui.info('Generated migrations are scaffolds. Review and adjust them before running `storyblok migrations run`.');

          // Dry-run: show analysis only, no prompts, no file writes
          if (!options.dryRun) {
            // Determine if --migrations was explicitly passed (auto-generate) or is just the default (prompt)
            const explicitMigrations = command.getOptionValueSource('migrations') === 'cli';
            const shouldGenerate = explicitMigrations || await confirm({
              message: 'Generate migration files for breaking changes?',
              default: true,
            });

            if (shouldGenerate) {
              const migrationTimestamp = new Date().toISOString();
              const resolvedBase = resolvePath(basePath, '');

              // Show detected renames for confirmation, or log them in explicit mode
              for (const comp of breakingChanges) {
                const renames = comp.changes.filter(c => c.kind === 'rename');
                if (renames.length > 0 && explicitMigrations) {
                  for (const r of renames) {
                    if (r.kind === 'rename') {
                      ui.log(`  Assumed rename in '${comp.componentName}': ${r.oldField} → ${r.field}`);
                    }
                  }
                }
                if (renames.length > 0 && !explicitMigrations) {
                  ui.br();
                  ui.log(`Detected renames in '${comp.componentName}':`);
                  for (const r of renames) {
                    if (r.kind === 'rename') {
                      ui.log(`  ${r.oldField} → ${r.field}`);
                    }
                  }
                  const renameConfirmed = await confirm({
                    message: 'Are these renames correct?',
                    default: true,
                  });
                  if (!renameConfirmed) {
                    // Convert renames to separate removals
                    comp.changes = comp.changes.map((c) => {
                      if (c.kind === 'rename') {
                        return { kind: 'removed' as const, field: c.oldField, renameHint: { newField: c.field } };
                      }
                      return c;
                    });
                  }
                }

                const code = renderMigrationCode(comp.changes);
                const path = await writeMigrationFile({
                  spaceId: space,
                  componentName: comp.componentName,
                  code,
                  timestamp: migrationTimestamp,
                  basePath: resolvedBase,
                });
                ui.log(`  Generated: ${path}`);
              }

              ui.br();
              ui.info(`Run migrations when ready: storyblok migrations run --space ${space}`);
            }
          }
        }
      }

      // Warn about deleted components
      if (options.delete) {
        const deletedComponents = diffResult.diffs.filter(d => d.type === 'component' && d.action === 'stale');
        for (const comp of deletedComponents) {
          ui.warn(`Component '${comp.name}' will be deleted. Stories using it will have out-of-schema content.`);
        }
      }

      if (diffResult.stale > 0 && !options.delete) {
        ui.warn(`${diffResult.stale} stale entity(s) exist remotely but not in schema. Use --delete to remove.`);
      }

      // 7. Dry run stops here
      if (options.dryRun) {
        ui.info('Dry run — no changes applied.');
        logger.info('Dry run completed', { creates: diffResult.creates, updates: diffResult.updates });
        return;
      }

      // 8. Save changeset
      const resolvedPath = resolvePath(basePath, '');
      const timestamp = new Date().toISOString();

      const changesetPath = await saveChangeset(resolvedPath, {
        timestamp,
        spaceId: Number(space),
        remote: { components: rawComponents, componentFolders: rawComponentFolders, datasources: rawDatasources },
        changes: buildChangesetEntries(diffResult, resolved, remote, { delete: options.delete }),
      });
      logger.info('Changeset saved', { path: changesetPath });

      // 9. Execute push
      if (diffResult.creates === 0 && diffResult.updates === 0 && (!options.delete || diffResult.stale === 0)) {
        ui.ok('Everything up to date — nothing to push.');
        return;
      }

      const pushSpinner = ui.createSpinner('Pushing schema...');
      const result = await executePush(space, resolved, remote, diffResult, { delete: options.delete, pendingFolderAssignments });

      summary.total = result.created + result.updated + result.deleted;
      summary.succeeded = summary.total;

      pushSpinner.succeed(`Pushed ${result.created} creations, ${result.updated} updates${result.deleted > 0 ? `, ${result.deleted} deletions` : ''}.`);
    }
    catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    }
    finally {
      logger.info('Schema push finished', { summary });
      reporter.addSummary('schemaPushResults', summary);
      reporter.finalize();
    }
  });
