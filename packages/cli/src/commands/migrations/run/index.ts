import { Spinner } from '@topcli/spinner';
import { getProgram } from '../../../program';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import type { MigrationsRunOptions } from './constants';
import { migrationsCommand } from '../command';
import { fetchStoriesByComponent, fetchStory, updateStory } from '../../stories/actions';
import { readMigrationFiles } from './actions';
import { handleMigrations, summarizeMigrationResults } from './operations';
import type { Story, StoryContent } from '../../stories/constants';
import chalk from 'chalk';
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from '../../stories/utils';

const program = getProgram();

migrationsCommand.command('run [componentName]')
  .description('Run migrations')
  .option('--fi, --filter <filter>', 'glob filter to apply to the components before pushing')
  .option('-d, --dry-run', 'Preview changes without applying them to Storyblok')
  .option('-q, --query <query>', 'Filter stories by content attributes using Storyblok filter query syntax. Example: --query="[highlighted][in]=true"')
  .option('--starts-with <path>', 'Filter stories by path. Example: --starts-with="/en/blog/"')
  .option('--publish <publish>', 'Options for publication mode: all | published | published-with-changes')
  .action(async (componentName: string | undefined, options: MigrationsRunOptions) => {
    konsola.title(` ${commands.MIGRATIONS} `, colorPalette.MIGRATIONS, componentName ? `Running migrations for component ${componentName}...` : 'Running migrations...');

    // Global options
    const verbose = program.opts().verbose;

    const { filter, dryRun = false, query, startsWith, publish } = options;

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

    try {
      const spinner = new Spinner({
        verbose: !isVitest,
      }).start(`Fetching migration files and stories...`);

      // Read migration files
      const migrationFiles = await readMigrationFiles({
        space,
        path,
        filter,
      });

      if (migrationFiles.length === 0) {
        spinner.failed(`No migration files found for space "${space}"${filter ? ` matching filter "${filter}"` : ''}.`);
        return;
      }

      // Filter migrations based on component name if provided
      const filteredMigrations = componentName
        ? migrationFiles.filter((file) => {
            // Match any migration file that starts with the component name and is followed by either
            // the end of the filename or a dot
            return file.name.match(new RegExp(`^${componentName}(\\..*)?\.js$`));
          })
        : migrationFiles;

      if (filteredMigrations.length === 0) {
        spinner.failed(`No migration files found${componentName ? ` for component "${componentName}"` : ''}${filter ? ` matching filter "${filter}"` : ''} in space "${space}".`);
        return;
      }

      // Spinner doesn't have update method, so we'll stop and start a new one
      spinner.succeed(`Found ${filteredMigrations.length} migration files.`);
      const storiesSpinner = new Spinner({ verbose: !isVitest }).start(`Fetching stories...`);

      // Fetch stories using the base component name
      const stories = await fetchStoriesByComponent(
        {
          spaceId: space,
          token: password,
          region,
        },
        // Filter options
        {
          componentName,
          query,
          starts_with: startsWith,
        },
      );

      if (!stories || stories.length === 0) {
        storiesSpinner.failed(`No stories found${componentName ? ` for component "${componentName}"` : ''}.`);
        return;
      }

      // Fetch full content for each story
      const storiesWithContent = await Promise.all(stories.map(async (story) => {
        const fullStory = await fetchStory(space, password, region, story.id.toString());
        return {
          ...story,
          content: fullStory?.content,
        };
      }));

      // Filter out stories with no content
      const validStories = storiesWithContent.filter(story => story.content);

      // Build filter message parts
      const filterParts = [];
      if (componentName) {
        filterParts.push(`component "${componentName}"`);
      }
      if (startsWith) {
        filterParts.push(chalk.hex(colorPalette.PRIMARY)(`starts_with=${startsWith}`));
      }
      if (query) {
        filterParts.push(chalk.hex(colorPalette.PRIMARY)(`filter_query=${query}`));
      }

      // Create filter message
      const filterMessage = filterParts.length > 0
        ? ` (filtered by ${filterParts.join(' and ')})`
        : '';

      // Spinner doesn't have update method, so we'll stop and start a new one
      storiesSpinner.succeed(`Fetched ${validStories.length} ${validStories.length === 1 ? 'story' : 'stories'} with related content${filterMessage}.`);

      // Process migrations using the new operations module
      const processingSpinner = new Spinner({ verbose: !isVitest }).start(`Processing migrations...`);
      processingSpinner.succeed(`Starting to process ${validStories.length} stories with ${filteredMigrations.length} migrations...`);

      const migrationResults = await handleMigrations({
        migrationFiles: filteredMigrations,
        stories: validStories,
        space,
        path,
        componentName,
        password,
        region,
      });

      // Summarize the results
      summarizeMigrationResults(migrationResults);

      // Update the stories in Storyblok with the modified content
      if (migrationResults.successful.length > 0 && !dryRun) {
        const updateSpinner = new Spinner({ verbose: !isVitest }).start(`Updating stories in Storyblok...`);

        // Group successful migrations by story ID to get the latest content for each story
        const storiesByIdMap = new Map<number, { id: number; name: string; content: StoryContent; published?: boolean; published_at?: string; unpublished_changes?: boolean }>();

        // Get the latest content for each story (in case multiple migrations were applied)
        migrationResults.successful.forEach((result) => {
          // Find the original story to get its published status
          const originalStory = validStories.find(s => s.id === result.storyId);
          storiesByIdMap.set(result.storyId, {
            id: result.storyId,
            name: result.name,
            content: result.content,
            published: originalStory?.published,
            published_at: originalStory?.published_at || undefined,
            unpublished_changes: originalStory?.unpublished_changes,
          });
        });

        const storiesToUpdate = Array.from(storiesByIdMap.values());

        if (storiesToUpdate.length === 0) {
          updateSpinner.succeed(`No stories need to be updated in Storyblok.`);
        }
        else {
          updateSpinner.succeed(`Found ${storiesToUpdate.length} stories to update.`);

          // Update each story
          let successCount = 0;
          let failCount = 0;

          for (const story of storiesToUpdate) {
            const storySpinner = new Spinner({ verbose: !isVitest }).start(`Updating story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())}...`);
            const payload: {
              story: Partial<Story>;
              force_update?: string;
              publish?: number;
            } = {
              story: {
                content: story.content,
                id: story.id,
                name: story.name,
              },
              force_update: '1',
            };

            // If the story is published and has no unpublished changes, publish it
            if (publish === 'published' && isStoryPublishedWithoutChanges(story)) {
              payload.publish = 1;
            }

            // If the story is published and has unpublished changes, publish it
            if (publish === 'published-with-changes' && isStoryWithUnpublishedChanges(story)) {
              payload.publish = 1;
            }

            // If the story is not published, publish it
            if (publish === 'all') {
              payload.publish = 1;
            }

            try {
              const updatedStory = await updateStory(space, password, region, story.id, payload);

              if (updatedStory) {
                successCount++;
                storySpinner.succeed(`Updated story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())} - Completed in ${storySpinner.elapsedTime.toFixed(2)}ms`);
              }
              else {
                failCount++;
                storySpinner.failed(`Failed to update story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())}`);
              }
            }
            catch (error) {
              failCount++;
              storySpinner.failed(`Failed to update story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())}: ${(error as Error).message}`);
            }
          }

          // Show summary
          if (failCount > 0) {
            konsola.warn(`Updated ${successCount} stories successfully, ${failCount} failed.`);
          }
          else if (successCount > 0) {
            konsola.ok(`Successfully updated ${successCount} stories in Storyblok.`, true);
          }
        }
      }
      else if (dryRun) {
        konsola.info(`Dry run mode: No stories were updated in Storyblok.`);
      }
      else if (migrationResults.successful.length === 0) {
        konsola.info(`No stories were modified by the migrations.`);
      }
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
