/**
 * What the content migration commands share: where a space's content
 * migrations and their journal live, writing a new one, the story fields the
 * engine reads, and the guard against pending releases.
 */
import chalk from "chalk";
import { dirname, join, relative, resolve } from "pathe";
import { generateMigrationSource, generateSnapshot } from "@storyblok/schema/codegen";
import type { MigrationOpSource, WireComponent } from "@storyblok/schema/codegen";
import {
  checkPendingReleases,
  discoverMigrations,
  MigrationError,
  nextMigrationId,
  resolveJournal,
} from "@storyblok/schema/migrations";
import type { Journal, StoryForMigration } from "@storyblok/schema/migrations";
import { getMapiClient } from "../../api";
import { getUI } from "../../lib/ui";
import { CommandError, toError } from "../../utils";
import { handleAPIError } from "../../utils/error/api-error";
import { fileExists, resolvePath, saveToFile } from "../../utils/filesystem";
import type { Story } from "../stories/constants";

export function migrationsDirectory(path: string | undefined, space: string): string {
  return resolvePath(path, `migrations/${space}`);
}

export type WriteContentMigrationOptions = {
  path: string | undefined;
  space: string;
  /** Free text the filename slug is derived from. */
  name: string;
  /** The schema entry file, as given on the command line. */
  schemaEntry: string;
  ops: readonly MigrationOpSource[];
  title?: string;
  /** The space's components before the migration; omit to skip the `.before.ts` snapshot. */
  before?: { components: readonly WireComponent[]; reads: readonly string[] };
};

export type WrittenContentMigration = { migrationPath: string; beforePath?: string };

/** The module specifier a file in `fromDirectory` imports `file` by. */
function importSpecifier(fromDirectory: string, file: string): string {
  const specifier = relative(fromDirectory, resolve(file)).replace(/\.(?:ts|tsx|js)$/, "");
  return specifier.startsWith("../") ? specifier : `./${specifier}`;
}

/**
 * Writes a `defineMigration` file numbered after the space's existing
 * migrations, plus its `.before.ts` snapshot. Refuses to overwrite either.
 */
export async function writeContentMigration(
  options: WriteContentMigrationOptions,
): Promise<WrittenContentMigration> {
  const directory = migrationsDirectory(options.path, options.space);
  const existing = await discoverMigrations(directory);
  const id = nextMigrationId(
    existing.map((migration) => migration.id),
    options.name,
  );
  const migrationPath = join(directory, `${id}.ts`);
  const beforePath = options.before ? join(directory, `${id}.before.ts`) : undefined;

  for (const file of [migrationPath, beforePath]) {
    if (file && (await fileExists(file))) {
      throw new CommandError(`${file} already exists. Move or delete it, then run again.`);
    }
  }

  const source = generateMigrationSource({
    schemaImport: importSpecifier(dirname(migrationPath), options.schemaEntry),
    beforeImport: beforePath ? `./${id}.before` : undefined,
    title: options.title,
    ops: options.ops,
  });
  if (options.before && beforePath) {
    await saveToFile(beforePath, generateSnapshot({ ...options.before, migrationId: id }));
  }
  await saveToFile(migrationPath, source);

  return { migrationPath, beforePath };
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
