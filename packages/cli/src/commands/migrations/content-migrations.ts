/**
 * What `apply`, `list`, and `undo` share: where a space's content migrations
 * and their journal live, the story fields the engine reads, and the guard
 * against pending releases.
 */
import chalk from "chalk";
import { checkPendingReleases, MigrationError, resolveJournal } from "@storyblok/schema/migrations";
import type { Journal, StoryForMigration } from "@storyblok/schema/migrations";
import { getMapiClient } from "../../api";
import { getUI } from "../../lib/ui";
import { CommandError, toError } from "../../utils";
import { handleAPIError } from "../../utils/error/api-error";
import { resolvePath } from "../../utils/filesystem";
import type { Story } from "../stories/constants";

export function migrationsDirectory(path: string | undefined, space: string): string {
  return resolvePath(path, `migrations/${space}`);
}

/** The journal sits beside the space directories, so one journal serves every space. */
export function contentJournal(path: string | undefined): Journal {
  return resolveJournal(resolvePath(path, "migrations"));
}

export function toStoryForMigration(story: Story): StoryForMigration {
  return {
    id: story.id,
    slug: story.full_slug ?? story.slug ?? String(story.id),
    content: story.content,
    published: story.published,
    unpublished_changes: story.unpublished_changes,
  };
}

/** The engine's errors are about the user's migrations or journal, not a CLI failure. */
export function toMigrationCommandError(error: unknown): Error {
  return error instanceof MigrationError ? new CommandError(error.message) : toError(error);
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

async function fetchReleases(space: string) {
  try {
    const { data } = await getMapiClient().releases.list({
      path: { space_id: Number(space) },
      throwOnError: true,
    });
    return data.releases;
  } catch (error) {
    handleAPIError("pull_releases", error);
  }
}

/**
 * Content in a release is out of a migration's reach, and deploying the release
 * later replaces the migrated draft. Refuses unless `allow` is set; `warnOnly`
 * reports without refusing, for a run that writes nothing.
 */
export async function guardPendingReleases(
  space: string,
  options: { allow?: boolean; warnOnly?: boolean },
): Promise<void> {
  const check = checkPendingReleases(await fetchReleases(space), {
    allowPendingReleases: options.allow || options.warnOnly,
  });
  if (check.pending.length === 0) {
    return;
  }

  const names = check.pending.map((release) => `  - ${release.name} (${release.id})`).join("\n");
  if (!check.proceed) {
    throw new CommandError(
      `Space ${space} has pending releases. Their content is out of the migration's reach, and deploying them would overwrite the migrated stories:\n${names}\nDeploy or delete them first, or pass --allow-pending-releases to run anyway.`,
    );
  }
  getUI().warn(
    `${chalk.bold(plural(check.pending.length, "pending release", "pending releases"))} will not be migrated, and deploying them overwrites the migrated stories:\n${names}`,
  );
}
