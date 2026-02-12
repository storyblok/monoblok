import type { Command } from 'commander';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication, toError } from '../../../utils';
import { migrationsCommand } from '../command';
import { session } from '../../../session';
import { readRollbackFile } from './actions';
import { updateStory } from '../../stories/actions';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';
import chalk from 'chalk';

const rollbackCmd = migrationsCommand.command('rollback [migrationFile]')
  .description('Rollback a migration')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

rollbackCmd
  .action(async (migrationFile: string, _options: unknown, command: Command) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(
      `${commands.MIGRATIONS}`,
      colorPalette.MIGRATIONS,
      migrationFile
        ? `Rolling back migration ${chalk.hex(colorPalette.MIGRATIONS)(migrationFile)}...`
        : 'Rolling back migration...',
    );

    const { space, path, verbose } = command.optsWithGlobals();

    logger.info('Migration rollback started', {
      migrationFile,
      space,
      path,
    });

    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    try {
      // Read the rollback data
      const rollbackData = await readRollbackFile({
        space,
        path,
        migrationFile,
      });

      const rollbackSummary = {
        total: rollbackData.stories.length,
        succeeded: 0,
        failed: 0,
      };

      // Restore each story to its original state
      for (const story of rollbackData.stories) {
        const spinner = ui.createSpinner(`Restoring story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.storyId)}...`);
        try {
          const payload: any = {
            story: {
              content: story.content,
              id: story.storyId,
              name: story.name,
            },
            force_update: '1',
          };

          // Only restore publication status if it was saved in the rollback data
          // For backwards compatibility, we check if the published status exists in the rollback data
          if (story.published !== undefined && story.unpublished_changes !== undefined) {
            // If the story was originally published without changes, publish it
            if (story.published && !story.unpublished_changes) {
              payload.publish = 1;
            }
            // Otherwise, don't publish (let it remain as draft or with unpublished changes)
          }

          await updateStory(space, story.storyId, payload);
          rollbackSummary.succeeded += 1;
          spinner.succeed(`Restored story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.storyId)} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`);

          logger.info('Story restored', {
            storyId: story.storyId,
            migrationFile,
            space,
          });
        }
        catch (maybeError) {
          const error = toError(maybeError);
          rollbackSummary.failed += 1;
          spinner.failed(`Failed to restore story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.storyId)}: ${(error as Error).message}`);
          logger.error('Failed to restore story', {
            storyId: story.storyId,
            migrationFile,
            space,
            error,
          });
        }
      }

      logger.info('Migration rollback finished', {
        migrationFile,
        space,
        results: rollbackSummary,
      });
    }
    catch (error) {
      handleError(new CommandError(`Failed to rollback migration: ${(error as Error).message}`), verbose);
    }
  });
