import { Spinner } from '@topcli/spinner';
import chalk from 'chalk';
import { colorPalette } from '../../../constants';
import { isVitest, konsola } from '../../../utils';
import type { RegionCode } from '../../../constants';
import type { StoryContent } from '../../stories/constants';
import { applyMigrationToAllBlocks, getMigrationFunction } from './actions';
import { getComponentNameFromFilename } from '../../../utils/filesystem';
import type { MigrationFile } from './constants';
import { hash } from 'ohash';
import { saveRollbackData } from '../rollback/actions';

/**
 * Handles the processing of migration files for stories
 * @param options - Options for handling migrations
 * @param options.migrationFiles - Array of migration files to process
 * @param options.stories - Array of stories to apply migrations to
 * @param options.space - Space ID where the stories are located
 * @param options.path - Path to the migrations directory
 * @param options.componentName - Optional component name to filter migrations
 * @param options.password - Optional password for authentication
 * @param options.region - Optional region code for API requests
 * @returns {Promise<{
 *   successful: Array<{
 *     storyId: number;
 *     name: string;
 *     migrationName: string;
 *     content: StoryContent;
 *   }>;
 *   failed: Array<{
 *     storyId: number;
 *     migrationName: string;
 *     error: unknown;
 *   }>;
 *   skipped: Array<{
 *     storyId: number;
 *     name: string;
 *     migrationName: string;
 *     reason: string;
 *   }>;
 * }>} Object containing arrays of successful, failed, and skipped migrations
 */
export async function handleMigrations({
  migrationFiles,
  stories,
  space,
  path,
  componentName,
}: {
  migrationFiles: MigrationFile[];
  stories: Array<{ id: number; name: string; content?: StoryContent }>;
  space: string;
  path: string;
  componentName?: string;
  password?: string;
  region?: RegionCode;
}): Promise<{
    successful: Array<{
      storyId: number;
      name: string;
      migrationName: string;
      content: StoryContent;
    }>;
    failed: Array<{ storyId: number; migrationName: string; error: unknown }>;
    skipped: Array<{ storyId: number; name: string; migrationName: string; reason: string }>;
  }> {
  const results = {
    successful: [] as Array<{
      storyId: number;
      name: string;
      migrationName: string;
      content: StoryContent;
    }>,
    failed: [] as Array<{ storyId: number; migrationName: string; error: unknown }>,
    skipped: [] as Array<{ storyId: number; name: string; migrationName: string; reason: string }>,
  };

  // Filter migrations based on component name if provided
  const relevantMigrations = componentName
    ? migrationFiles.filter((file) => {
        const targetComponent = getComponentNameFromFilename(file.name);
        return targetComponent.split('.')[0] === componentName;
      })
    : migrationFiles;

  // Process each migration file
  for (const migrationFile of relevantMigrations) {
    // Filter out stories without content
    const validStories = stories.filter(story => story.content) as Array<{ id: number; name: string; content: StoryContent }>;

    // Skip processing if no valid stories
    if (validStories.length === 0) {
      continue;
    }

    // First save all original states of stories before any modification
    // This ensures we have a snapshot before any change is made
    await saveRollbackData({
      space,
      path,
      stories: validStories,
      migrationFile: migrationFile.name,
    });

    // Load the migration function using dynamic import
    const migrationFunction = await getMigrationFunction(migrationFile.name, space, path);

    if (!migrationFunction) {
      // If migration function fails to load, mark all stories as failed for this migration
      stories.forEach((story) => {
        results.failed.push({
          storyId: story.id,
          migrationName: migrationFile.name,
          error: new Error(`Failed to load migration function from file "${migrationFile.name}"`),
        });
      });
      continue;
    }

    // Determine the target component from the migration filename if not explicitly provided
    const targetComponent = componentName || getComponentNameFromFilename(migrationFile.name);

    // Process each story
    for (const story of stories) {
      if (!story.content) {
        results.failed.push({
          storyId: story.id,
          migrationName: migrationFile.name,
          error: new Error('Story content is missing'),
        });
        continue;
      }

      // Create a deep copy of the story content to avoid modifying the original
      const storyContent = structuredClone(story.content) as StoryContent;

      // Calculate the original content hash for later comparison
      const originalContentHash = hash(story.content);

      try {
        // Apply the migration function to all matching components in the content
        const modified = applyMigrationToAllBlocks(storyContent, migrationFunction, targetComponent);

        // Calculate the new content hash
        const newContentHash = hash(storyContent);

        // Check if the content was actually modified by comparing hashes
        const contentChanged = originalContentHash !== newContentHash;

        if (modified && contentChanged) {
          const spinner = new Spinner({ verbose: !isVitest });
          spinner.start(`Applying migration ${chalk.hex(colorPalette.MIGRATIONS)(migrationFile.name)} to story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())}...`);
          spinner.succeed(`Migration ${chalk.hex(colorPalette.MIGRATIONS)(migrationFile.name)} applied to story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`);

          // Store the migration that was applied
          results.successful.push({
            storyId: story.id,
            name: story.name,
            migrationName: migrationFile.name,
            content: storyContent,
          });
        }
        else if (modified && !contentChanged) {
          results.skipped.push({
            storyId: story.id,
            name: story.name,
            migrationName: migrationFile.name,
            reason: 'No changes detected after migration',
          });
        }
        else {
          // Get the base component name from the target component
          const baseComponent = targetComponent.split('.')[0];
          // Only add to skipped without logging
          results.skipped.push({
            storyId: story.id,
            name: story.name,
            migrationName: migrationFile.name,
            reason: baseComponent === componentName ? 'No matching components found' : 'Different component target',
          });
        }
      }
      catch (error) {
        const spinner = new Spinner({ verbose: !isVitest });
        spinner.start(`Applying migration ${chalk.hex(colorPalette.MIGRATIONS)(migrationFile.name)} to story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())}...`);
        spinner.failed(`Failed to apply migration ${chalk.hex(colorPalette.MIGRATIONS)(migrationFile.name)} to story ${chalk.hex(colorPalette.PRIMARY)(story.name || story.id.toString())}`);
        results.failed.push({
          storyId: story.id,
          migrationName: migrationFile.name,
          error,
        });
      }
    }
  }

  return results;
}

/**
 * Summarizes the results of the migration operations
 * @param results - Object containing migration operation results
 * @param results.successful - Array of successfully applied migrations
 * @param results.failed - Array of failed migrations
 * @param results.skipped - Array of skipped migrations
 */
export function summarizeMigrationResults(results: {
  successful: Array<{
    storyId: number;
    name: string;
    migrationName: string;
    content: StoryContent;
  }>;
  failed: Array<{ storyId: number; migrationName: string; error: unknown }>;
  skipped: Array<{ storyId: number; name: string; migrationName: string; reason: string }>;
}): void {
  const { successful, failed, skipped } = results;

  // Count unique stories that were successfully processed
  const successfulStoryIds = new Set(successful.map(result => result.storyId));
  const failedStoryIds = new Set(failed.map(result => result.storyId));

  // Count unique migrations that were successfully applied
  const successfulMigrations = new Set(successful.map(result => result.migrationName));

  konsola.br();
  konsola.ok(`Successfully applied ${successfulMigrations.size} migrations to ${successfulStoryIds.size} stories`, true);

  // Group skipped stories by reason
  const skippedByReason = skipped.reduce((acc, item) => {
    if (!acc[item.reason]) {
      acc[item.reason] = [];
    }
    acc[item.reason].push(item);
    return acc;
  }, {} as Record<string, typeof skipped>);

  if (Object.keys(skippedByReason).length > 0) {
    konsola.info(`Skipped migrations:`);
    for (const [reason, items] of Object.entries(skippedByReason)) {
      const uniqueStories = new Set(items.map(item => item.storyId));
      konsola.info(`  • ${reason}: ${uniqueStories.size} stories`);
    }
  }

  if (failed.length > 0) {
    konsola.warn(`- Failed to apply migrations to ${failedStoryIds.size} stories`, true);

    // Group failures by story ID for better reporting
    const failuresByStory = new Map<number, Array<{ migrationName: string; error: unknown }>>();

    failed.forEach(({ storyId, migrationName, error }) => {
      if (!failuresByStory.has(storyId)) {
        failuresByStory.set(storyId, []);
      }
      failuresByStory.get(storyId)?.push({ migrationName, error });
    });

    // Log failures grouped by story
    failuresByStory.forEach((failures, storyId) => {
      konsola.error(`Story ID ${storyId}:`);
      failures.forEach(({ migrationName, error }) => {
        konsola.error(`- Migration ${migrationName}: ${(error as Error).message}`);
      });
    });
  }
  else {
    konsola.ok(`No failures reported`);
  }
  konsola.br();
}
