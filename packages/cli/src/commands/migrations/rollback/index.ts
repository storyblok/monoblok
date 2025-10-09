import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, konsola, requireAuthentication } from '../../../utils';
import { getProgram } from '../../../program';
import { migrationsCommand } from '../command';
import { session } from '../../../session';
import { readRollbackFile } from './actions';
import { updateStory } from '../../stories/actions';
import { mapiClient } from '../../../api';
import { Spinner } from '@topcli/spinner';
import chalk from 'chalk';

const program = getProgram();

migrationsCommand.command('rollback [migrationFile]')
  .description('Rollback a migration')
  .action(async (migrationFile: string) => {
    konsola.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, `Rolling back migration ${chalk.hex(colorPalette.MIGRATIONS)(migrationFile)}...`);

    const verbose = program.opts().verbose;

    // Command options
    const { space, path } = migrationsCommand.opts();

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const { password, region } = state;
    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    try {
      // Read the rollback data
      const rollbackData = await readRollbackFile({
        space,
        path,
        migrationFile,
      });

      // Restore each story to its original state
      for (const story of rollbackData.stories) {
        const spinner = new Spinner({ verbose }).start(`Restoring story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.storyId)}...`);
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
          spinner.succeed(`Restored story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.storyId)}`);
        }
        catch (error) {
          spinner.failed(`Failed to restore story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.storyId)}: ${(error as Error).message}`);
        }
      }
    }
    catch (error) {
      handleError(new CommandError(`Failed to rollback migration: ${(error as Error).message}`), verbose);
    }
  });
