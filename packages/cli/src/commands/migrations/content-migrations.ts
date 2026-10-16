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
import { fetchStory, updateStory } from "../stories/actions";
import type { Story } from "../stories/constants";
import type { Component } from "../../types";

export function migrationsDirectory(path: string | undefined, space: string): string {
  return resolvePath(path, `migrations/${space}`);
}

/**
 * The path relative to the current directory, or absolute when it lies outside
 * and the relative form would be a chain of `..` segments.
 */
export function displayPath(file: string): string {
  const relativePath = relative(process.cwd(), file);
  return relativePath.startsWith("..") ? file : relativePath;
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
  /**
   * Freezes the schema the migration reads and writes in `.before.ts` and
   * `.after.ts` snapshots. Without it, the migration is typed against the live
   * schema entry file.
   */
  snapshots?: {
    /** The space's components before the migration. */
    before: readonly WireComponent[];
    /** The components the migration leaves the space with. */
    after: readonly WireComponent[];
    /** The blocks whose fields the migration reads and writes. */
    blocks: readonly string[];
  };
};

export type WrittenContentMigration = {
  migrationPath: string;
  beforePath?: string;
  afterPath?: string;
};

const TS_TO_JS_EXTENSION: Record<string, string> = {
  ".ts": ".js",
  ".tsx": ".js",
  ".mts": ".mjs",
  ".cts": ".cjs",
};

/**
 * The module specifier a file in `fromDirectory` imports `file` by. TypeScript
 * resolves a `.js` specifier to its `.ts` source under every module resolution
 * mode, including `nodenext`, which rejects one without an extension.
 */
function importSpecifier(fromDirectory: string, file: string): string {
  const specifier = relative(fromDirectory, resolve(file)).replace(
    /\.(?:tsx?|mts|cts)$/,
    (extension) => TS_TO_JS_EXTENSION[extension] ?? extension,
  );
  return specifier.startsWith("../") ? specifier : `./${specifier}`;
}

/**
 * A local schema's components in the shape the snapshot generator reads. A
 * local block names its folder by slug path and its tags by name, and its
 * restrictions do the same, so those stand in for the space's group uuids and
 * tag ids.
 */
export function localSnapshotComponents(components: readonly Component[]): WireComponent[] {
  return components.map((component) => {
    const folder: unknown = Reflect.get(component, "folder");
    const tags: unknown = Reflect.get(component, "tags");
    return {
      name: component.name,
      schema: component.schema,
      is_root: component.is_root,
      is_nestable: component.is_nestable,
      component_group_uuid: typeof folder === "string" ? folder : null,
      internal_tag_ids: Array.isArray(tags) ? tags.map(String) : null,
    };
  });
}

/**
 * Writes a `defineMigration` file named after its creation time, plus its
 * snapshots. Refuses to overwrite a file of the same id, including a snapshot
 * the migration would not write.
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
  const snapshotPaths = {
    before: join(directory, `${id}.before.ts`),
    after: join(directory, `${id}.after.ts`),
  };

  for (const file of [migrationPath, snapshotPaths.before, snapshotPaths.after]) {
    if (await fileExists(file)) {
      throw new CommandError(
        `${displayPath(file)} already exists. Move or delete it, then run again.`,
      );
    }
  }

  const { snapshots } = options;
  const source = generateMigrationSource({
    ...(snapshots
      ? { afterImport: `./${id}.after.js`, beforeImport: `./${id}.before.js` }
      : { schemaImport: importSpecifier(dirname(migrationPath), options.schemaEntry) }),
    title: options.title,
    ops: options.ops,
  });
  if (snapshots) {
    const { before, after, blocks } = snapshots;
    await saveToFile(
      snapshotPaths.before,
      generateSnapshot({ components: before, blocks, kind: "before", migrationId: id }),
    );
    await saveToFile(
      snapshotPaths.after,
      generateSnapshot({ components: after, blocks, kind: "after", migrationId: id }),
    );
  }
  await saveToFile(migrationPath, source);

  return snapshots
    ? { migrationPath, beforePath: snapshotPaths.before, afterPath: snapshotPaths.after }
    : { migrationPath };
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
const RELEASE_CONSEQUENCES = {
  apply: { subject: "This run doesn't change", object: "the stories it writes" },
  undo: { subject: "This undo doesn't restore", object: "the stories it restores" },
} as const;

export async function guardPendingReleases(
  space: string,
  options: { command: keyof typeof RELEASE_CONSEQUENCES; allow?: boolean; warnOnly?: boolean },
): Promise<void> {
  const { subject, object } = RELEASE_CONSEQUENCES[options.command];
  const proceedAnyway = options.allow || options.warnOnly;
  let releases: Awaited<ReturnType<typeof fetchReleases>>;
  try {
    releases = await fetchReleases(space);
  } catch (maybeError) {
    if (!proceedAnyway) {
      throw maybeError;
    }
    getUI().warn(
      `Could not check for pending releases: ${toError(maybeError).message}. Deploying a pending release overwrites ${object}.`,
    );
    return;
  }

  const check = checkPendingReleases(releases, { allowPendingReleases: proceedAnyway });
  if (check.pending.length === 0) {
    return;
  }

  const names = check.pending.map((release) => `  - ${release.name} (${release.id})`).join("\n");
  const one = check.pending.length === 1;
  const consequence = `${subject} release content, and deploying ${one ? "the release" : "a release"} overwrites ${object}`;
  if (!check.proceed) {
    throw new CommandError(
      `Space ${space} has ${plural(check.pending.length, "pending release", "pending releases")}. ${consequence}:\n${names}\nDeploy or delete ${one ? "it" : "them"} first, or pass --allow-pending-releases to run anyway.`,
    );
  }
  getUI().warn(
    `Space ${space} has ${chalk.bold(plural(check.pending.length, "pending release", "pending releases"))}. ${consequence}:\n${names}`,
  );
}
