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
import { fetchStory, updateStory } from "../stories/actions";
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

/**
 * Reads and writes the stories of one command run. A content write without the
 * story's name clears it, so each write carries the name its read returned.
 */
export function storyAccess(space: string) {
  const names = new Map<number, string>();
  return {
    async read(id: number): Promise<Story | undefined> {
      const story = await fetchStory(space, id);
      if (story) names.set(id, story.name);
      return story;
    },
    async write(id: number, content: Record<string, unknown>, publish: boolean): Promise<void> {
      await updateStory(space, id, {
        story: { content, name: names.get(id) },
        force_update: "1",
        ...(publish ? { publish: 1 } : {}),
      });
    },
  };
}

export type StoryAccess = ReturnType<typeof storyAccess>;

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
 * Content in a release is stored apart from the story, so a run cannot change
 * it, and deploying the release later replaces the story the run wrote.
 * Refuses unless `allow` is set; `warnOnly` reports without refusing, for a run
 * that writes nothing. When the run may proceed anyway, a failed release check
 * is a warning rather than a reason to stop.
 */
export async function guardPendingReleases(
  space: string,
  options: { allow?: boolean; warnOnly?: boolean },
): Promise<void> {
  const proceedAnyway = options.allow || options.warnOnly;
  let releases: Awaited<ReturnType<typeof fetchReleases>>;
  try {
    releases = await fetchReleases(space);
  } catch (maybeError) {
    if (!proceedAnyway) {
      throw maybeError;
    }
    getUI().warn(
      `Could not check for pending releases: ${toError(maybeError).message}. Deploying a pending release overwrites the stories this run writes.`,
    );
    return;
  }

  const check = checkPendingReleases(releases, { allowPendingReleases: proceedAnyway });
  if (check.pending.length === 0) {
    return;
  }

  const names = check.pending.map((release) => `  - ${release.name} (${release.id})`).join("\n");
  const one = check.pending.length === 1;
  const consequence = `This run doesn't change release content, and deploying ${one ? "the release" : "a release"} overwrites the stories it writes`;
  if (!check.proceed) {
    throw new CommandError(
      `Space ${space} has ${plural(check.pending.length, "pending release", "pending releases")}. ${consequence}:\n${names}\nDeploy or delete ${one ? "it" : "them"} first, or pass --allow-pending-releases to run anyway.`,
    );
  }
  getUI().warn(
    `Space ${space} has ${chalk.bold(plural(check.pending.length, "pending release", "pending releases"))}. ${consequence}:\n${names}`,
  );
}
