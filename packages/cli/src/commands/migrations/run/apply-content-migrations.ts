import chalk from "chalk";
import { relative } from "pathe";
import { applyMigration, settleRun, validateMigration } from "@storyblok/schema";
import type {
  ApplyMigrationOutcome,
  LandedWrite,
  LoadedMigration,
  MigrationRun,
  PublishMode,
  SchemaLike,
  StoryForMigration,
} from "@storyblok/schema";
import { CommandError, fetchAllPages, toError } from "../../../utils";
import { createPipelineBackpressureLock } from "../../../utils/backpressure-lock";
import { handleAPIError } from "../../../utils/error/api-error";
import { fileExists } from "../../../utils/filesystem";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { loadSchemaEntry } from "../../../lib/validation/adapter";
import { loadSchemaModule } from "../../../utils/schema/classify-exports";
import { getMapiClient } from "../../../api";
import type { StoryScopeParams } from "../../stories/query-params";
import {
  contentJournal,
  DraftNotPublishedError,
  plural,
  storyAccess,
  toStoryForMigration,
} from "../content-migrations";
import type { StoryAccess } from "../content-migrations";
import { fetchComponents } from "../../components";
import { describeFolder, foldersNaming } from "../../schema/push/story-folders";
import { withoutStaleOps } from "./stale-ops";
import type { LiveFields } from "./stale-ops";

const PER_PAGE = 100;
const MIGRATION_EXTENSION = /\.(?:ts|js|mjs)$/;

/**
 * The ids of the stories in `scope` that contain at least one block the
 * migration targets, so the content fetch scales with the blocks it names, not
 * with the space.
 */
async function findCandidateStories(
  space: string,
  targets: readonly string[],
  scope: StoryScopeParams,
): Promise<number[]> {
  const client = getMapiClient();
  const ids = new Set<number>();

  try {
    for (const component of targets) {
      const stories = await fetchAllPages(
        (page) =>
          client.stories.list({
            path: { space_id: Number(space) },
            query: {
              ...scope,
              contain_component: component,
              per_page: PER_PAGE,
              page,
              story_only: true,
            },
            throwOnError: true,
          }),
        (data) => data.stories ?? [],
      );
      for (const story of stories) {
        ids.add(story.id);
      }
    }
  } catch (error) {
    handleAPIError("pull_stories", error);
  }

  return [...ids];
}

async function liveFields(space: string): Promise<LiveFields> {
  const components = (await fetchComponents(space)) ?? [];
  return new Map(
    components.map((component) => [
      component.name,
      new Map(Object.entries(component.schema ?? {}).map(([name, field]) => [name, field.type])),
    ]),
  );
}

/**
 * Folders name their default and allowed content types by block name, and a
 * migration only changes story content, so a folder can keep naming a block
 * after its stories were renamed away from it.
 */
async function warnAboutFoldersNaming(
  space: string,
  renamedBlocks: ReadonlyMap<string, string>,
): Promise<void> {
  if (renamedBlocks.size === 0) return;
  try {
    const folders = await foldersNaming(space, new Set(renamedBlocks.keys()));
    for (const folder of folders) {
      for (const name of new Set([folder.defaultRoot, ...folder.contentTypes])) {
        const to = name === undefined ? undefined : renamedBlocks.get(name);
        if (to === undefined) continue;
        getUI().warn(
          `Folder ${describeFolder(folder)} still names ${name} as a content type. Change it to ${to}, or schema push renames it when it renames the block.`,
        );
      }
    }
  } catch (maybeError) {
    getLogger().warn("Failed to check folders for renamed blocks", { error: toError(maybeError) });
  }
}

function changeSummary(run: MigrationRun): string {
  return `${plural(run.stories, "story", "stories")} (${plural(run.blocks, "block", "blocks")})`;
}

/**
 * The stories of one command run, each read at most once and kept up to date
 * with what the run wrote, or in a dry run would have written, so a later
 * migration sees an earlier one's output.
 */
function storyCache(space: string, access: StoryAccess) {
  const known = new Map<number, StoryForMigration>();
  /** Stories an earlier migration changed. */
  const changed = new Set<number>();
  const unreadable = new Set<number>();

  async function readMissing(ids: number[]): Promise<number> {
    const lock = createPipelineBackpressureLock();
    let unread = 0;
    await Promise.all(
      ids
        .filter((id) => !known.has(id) && !unreadable.has(id))
        .map(async (id) => {
          await lock.acquire();
          try {
            const story = await access.read(id);
            if (story) known.set(id, toStoryForMigration(story));
          } catch (maybeError) {
            unread++;
            unreadable.add(id);
            const error = toError(maybeError);
            getUI().warn(`Story ${id} could not be read, so it was not migrated: ${error.message}`);
            getLogger().error("Failed to read story", { storyId: id, space, error });
          } finally {
            lock.release();
          }
        }),
    );
    return unread;
  }

  return {
    /**
     * The stories one migration runs against: its candidates, and every story
     * an earlier migration changed. The API only matches the content it holds,
     * so in a dry run a block an earlier migration renamed or created is
     * invisible to it, and the engine skips any story the migration leaves
     * unchanged anyway.
     */
    async storiesFor(
      candidates: number[],
    ): Promise<{ stories: StoryForMigration[]; unread: number }> {
      const unread = await readMissing(candidates);
      const ids = new Set([...candidates, ...changed]);
      const stories = [...ids].flatMap((id) => known.get(id) ?? []);
      return { stories, unread };
    },
    /** The draft now holds `content`, published too when `published` is set. */
    wrote(story: StoryForMigration, content: Record<string, unknown>, published: boolean): void {
      changed.add(story.id);
      known.set(story.id, {
        ...story,
        content,
        published: story.published === true || published,
        unpublished_changes: !published && story.published === true,
      });
    },
    /** What a dry run would have written, with the publish state left as it is. */
    planned(story: StoryForMigration, content: Record<string, unknown>): void {
      changed.add(story.id);
      known.set(story.id, { ...story, content });
    },
    /** A write that failed leaves the story in a state the run can't tell, so it is read again. */
    forget(id: number): void {
      known.delete(id);
    },
  };
}

type SchemaCheck = {
  entry: LoadedMigration;
  schema: SchemaLike;
  nameOnlyBlocks?: readonly string[];
};

/**
 * Reports every warning, and the errors of every migration in one failure,
 * together with `failures` found before the check, such as unloadable snapshots.
 */
function assertMatchesSchemas(checks: SchemaCheck[], failures: string[] = []): void {
  for (const { entry, schema, nameOnlyBlocks } of checks) {
    const issues = validateMigration(entry.migration, schema, { nameOnlyBlocks });
    for (const issue of issues.filter(({ severity }) => severity === "warning")) {
      getUI().warn(`${entry.id}: op ${issue.op}: ${issue.message}`);
    }
    const errors = issues.filter(({ severity }) => severity === "error");
    if (errors.length > 0) {
      failures.push(
        `${entry.id} does not match the schema:\n${errors
          .map((issue) => `  - op ${issue.op}: ${issue.message}`)
          .join("\n")}`,
      );
    }
  }
  if (failures.length > 0) {
    throw new CommandError(failures.join("\n"));
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** The newest `snapshotFormat` this CLI reads. */
const SUPPORTED_SNAPSHOT_FORMAT = 1;

/** The `nameOnlyBlocks` of a snapshot, refusing a format this CLI cannot read. */
async function loadNameOnlyBlocks(file: string): Promise<readonly string[] | undefined> {
  const { nameOnlyBlocks, snapshotFormat } = await loadSchemaModule(file);
  if (typeof snapshotFormat === "number" && snapshotFormat > SUPPORTED_SNAPSHOT_FORMAT) {
    throw new CommandError(
      `${relative(process.cwd(), file)} has snapshot format ${snapshotFormat}, but this version of the Storyblok CLI reads up to format ${SUPPORTED_SNAPSHOT_FORMAT}. Update the Storyblok CLI.`,
    );
  }
  return isStringArray(nameOnlyBlocks) ? nameOnlyBlocks : undefined;
}

/** The `.before.ts` snapshot of the schema a migration was written against. */
async function findBeforeSnapshot(file: string): Promise<string | undefined> {
  const snapshot = file.replace(MIGRATION_EXTENSION, ".before.ts");
  return (await fileExists(snapshot)) ? snapshot : undefined;
}

/** The check against a snapshot, or why the snapshot could not be loaded. */
async function loadSnapshotCheck(
  entry: LoadedMigration,
  snapshot: string,
): Promise<SchemaCheck | string> {
  try {
    const { schema } = await loadSchemaEntry(snapshot, { requireBlocks: true });
    return { entry, schema, nameOnlyBlocks: await loadNameOnlyBlocks(snapshot) };
  } catch (maybeError) {
    const [reason] = toError(maybeError).message.split("\n");
    return `${entry.id}: the schema snapshot ${relative(process.cwd(), snapshot)} could not be loaded: ${reason.trim()}`;
  }
}

/**
 * Checks each migration against its own snapshot, so several migrations can be
 * checked in one run. Returns the ids of the migrations that have none.
 */
async function assertMatchesSnapshots(selected: LoadedMigration[]): Promise<string[]> {
  const unchecked: string[] = [];
  const checks: SchemaCheck[] = [];
  const loadFailures: string[] = [];
  for (const entry of selected) {
    const snapshot = await findBeforeSnapshot(entry.file);
    if (!snapshot) {
      unchecked.push(entry.id);
      continue;
    }
    const check = await loadSnapshotCheck(entry, snapshot);
    if (typeof check === "string") {
      loadFailures.push(check);
    } else {
      checks.push(check);
    }
  }
  if (loadFailures.length > 0) {
    loadFailures.push(
      "Fix the snapshots, check a migration against another schema entry file with --schema, or skip the check with --no-validate.",
    );
  }
  assertMatchesSchemas(checks, loadFailures);
  return unchecked;
}

function warnPublishedDraftOnly(
  id: string,
  outcome: ApplyMigrationOutcome,
  options: { dryRun: boolean; publish: PublishMode | undefined },
): void {
  const count = outcome.publishedDraftOnly;
  if (count === 0) {
    return;
  }
  const one = count === 1;
  const migrated = options.dryRun
    ? `${plural(count, "published story", "published stories")} would be`
    : plural(count, "published story was", "published stories were");
  const hint = options.publish
    ? `--publish ${options.publish} doesn't select ${one ? "it" : "them"}`
    : "pass --publish to publish with the migration";
  getUI().warn(
    `${id}: ${migrated} migrated as ${one ? "a draft" : "drafts"} only. The published version keeps the old content until someone publishes ${one ? "the story" : "them"}; ${hint}.`,
  );
}

export type ContentMigrationsCheck = {
  migrations: LoadedMigration[];
  /** A schema entry file to check the only migration against, instead of its snapshot. */
  schemaEntry?: string;
  validate: boolean;
};

/**
 * Checks content migrations against the schema each one was written for:
 * `schemaEntry` when given, otherwise the `.before.ts` snapshot beside it.
 */
export async function assertContentMigrationsMatchSchema({
  migrations,
  schemaEntry,
  validate,
}: ContentMigrationsCheck): Promise<void> {
  if (schemaEntry && !validate) {
    throw new CommandError("Pass either --schema or --no-validate, not both.");
  }

  if (schemaEntry) {
    // Each migration expects the schema as it stood before it, so one schema
    // can only describe the first of several.
    if (migrations.length !== 1) {
      throw new CommandError(
        migrations.length === 0
          ? "--schema checks a content migration, but no content migration was selected."
          : `--schema checks one migration against the schema as it stood before that migration. Name the migration to check, for example: storyblok migrations run ${migrations[0].id} --schema ${schemaEntry}`,
      );
    }
    const { schema } = await loadSchemaEntry(schemaEntry, { requireBlocks: true });
    const nameOnlyBlocks = await loadNameOnlyBlocks(schemaEntry);
    assertMatchesSchemas([{ entry: migrations[0], schema, nameOnlyBlocks }]);
  } else if (validate) {
    const unchecked = await assertMatchesSnapshots(migrations);
    if (unchecked.length > 0) {
      getUI().warn(
        `Not checked against a schema, because no .before.ts snapshot sits beside ${unchecked.length === 1 ? "it" : "them"}: ${unchecked.join(", ")}. Name a migration and pass --schema to check it against a schema entry file.`,
      );
    }
  }
}

export type ApplyContentMigrationsOptions = {
  /** The space the migrations write to. */
  space: string;
  path: string | undefined;
  migrations: LoadedMigration[];
  dryRun: boolean;
  publish?: PublishMode;
  scope: StoryScopeParams;
};

/**
 * Applies content migrations in order and records each run so it can be rolled
 * back. Throws a {@link CommandError} naming every problem once all migrations
 * ran.
 */
export async function applyContentMigrations({
  space,
  path,
  migrations: selected,
  dryRun,
  publish,
  scope,
}: ApplyContentMigrationsOptions): Promise<void> {
  const ui = getUI();
  const logger = getLogger();

  const live = await liveFields(space);
  const journal = contentJournal(path);
  /** Migrations with a run still in place, so a run that changes nothing need not be recorded. */
  const inPlace = new Set(
    (await journal.list(space)).filter((run) => !run.undoneAt).map((run) => run.migration),
  );
  const access = storyAccess(space);
  const cache = storyCache(space, access);
  const refusedEverything: string[] = [];
  let failed = 0;
  const notPublished: string[] = [];
  const renamedBlocks = new Map<string, string>();

  for (const entry of selected) {
    if (entry.migration.ops.length === 0) {
      ui.info(`${entry.id}: has no ops yet, so nothing was applied.`);
      continue;
    }
    const { migration, stale } = withoutStaleOps(entry.migration, live);
    for (const op of migration.ops) {
      if (op.kind === "renameBlock") renamedBlocks.set(op.block, op.to);
    }
    for (const { reason } of stale) {
      ui.warn(`${entry.id}: ${reason}`);
    }
    if (migration.ops.length === 0) {
      ui.info(
        `${entry.id}: every op was skipped because the space's blocks don't match it, so nothing was applied. Push the schema the migration was written for, then run it again.`,
      );
      continue;
    }
    const spinner = ui.createSpinner(`${entry.id}: fetching stories...`);
    const candidates = await findCandidateStories(space, migration.targets, scope);
    const { stories, unread } = await cache.storiesFor(candidates);
    failed += unread;
    spinner.succeed(
      `${entry.id}: ${plural(candidates.length, "story contains", "stories contain")} ${migration.targets.join(", ")}`,
    );

    const outcome = applyMigration({
      migration,
      id: entry.id,
      space,
      stories,
      publish,
    });

    for (const refusal of outcome.refusals) {
      ui.warn(`${chalk.bold(refusal.slug)}: ${refusal.reason}`);
    }
    // Stories already migrated by an earlier run neither change nor refuse, so
    // only a migration that refused every story containing its blocks failed.
    if (outcome.refusals.length > 0 && outcome.refusals.length >= candidates.length) {
      refusedEverything.push(entry.id);
    }

    warnPublishedDraftOnly(entry.id, outcome, { dryRun: Boolean(dryRun), publish });

    if (dryRun) {
      for (const write of outcome.writes) {
        cache.planned(write.story, write.content);
      }
      ui.info(
        outcome.writes.length === 0
          ? `${entry.id}: would change no stories.`
          : `${entry.id}: would change ${changeSummary(outcome.run)}.`,
      );
      ui.list(
        outcome.writes.map(
          (write, index) =>
            `${write.story.slug}: ${plural(outcome.inverse[index].patches.length, "block", "blocks")}`,
        ),
      );
      continue;
    }

    if (outcome.writes.length === 0) {
      // A first run with nothing to change is recorded, so the migration no
      // longer shows as pending; an empty run is never the one rolled back.
      if (outcome.refusals.length === 0 && !inPlace.has(entry.id)) {
        await journal.record(outcome.run, []);
        inPlace.add(entry.id);
        ui.info(`${entry.id}: changed no stories, recorded as ${chalk.bold(outcome.run.id)}.`);
        continue;
      }
      ui.info(`${entry.id}: changed no stories, so nothing was recorded.`);
      continue;
    }

    // Recorded before the first write, so a run that stops partway can still
    // be rolled back. A rollback skips stories whose content never changed.
    await journal.record({ ...outcome.run, interrupted: true }, outcome.inverse);

    const landed: LandedWrite[] = [];
    for (const write of outcome.writes) {
      try {
        await access.write(write.story.id, write.content, write.publish);
        landed.push({ story: write.story.id, published: write.publish });
        cache.wrote(write.story, write.content, write.publish);
        logger.info("Story migrated", { storyId: write.story.id, migration: entry.id, space });
      } catch (maybeError) {
        // The draft changed, so the run records it and a rollback can restore it.
        if (maybeError instanceof DraftNotPublishedError) {
          landed.push({ story: write.story.id, published: false });
          cache.wrote(write.story, write.content, false);
          notPublished.push(write.story.slug);
          ui.warn(
            `${chalk.bold(write.story.slug)}: the draft was migrated, but publishing it failed: ${maybeError.message}`,
          );
          logger.error("Failed to publish migrated story", {
            storyId: write.story.id,
            migration: entry.id,
            space,
            error: maybeError,
          });
          continue;
        }
        failed++;
        cache.forget(write.story.id);
        const error = toError(maybeError);
        ui.warn(`${chalk.bold(write.story.slug)} could not be written: ${error.message}`);
        logger.error("Failed to migrate story", {
          storyId: write.story.id,
          migration: entry.id,
          space,
          error,
        });
      }
    }

    // An entry for a run that changed nothing would become the most recent
    // run, which `rollback` picks by default, leaving the real work applied.
    if (landed.length === 0) {
      await journal.remove(outcome.run.id);
      ui.info(`${entry.id}: changed no stories, so nothing was recorded.`);
      continue;
    }

    const { run, inverse } = settleRun(outcome, landed);
    await journal.record(run, inverse);
    ui.info(`${entry.id}: changed ${changeSummary(run)}, recorded as ${chalk.bold(run.id)}.`);
  }

  await warnAboutFoldersNaming(space, renamedBlocks);

  const problems = [
    ...refusedEverything.map((id) => `${id} refused every story it matched`),
    ...(notPublished.length > 0
      ? [
          `${plural(notPublished.length, "story was", "stories were")} migrated as ${notPublished.length === 1 ? "a draft" : "drafts"} but could not be published: ${notPublished.join(", ")}`,
        ]
      : []),
    ...(failed > 0
      ? [
          `${plural(failed, "story", "stories")} could not be ${dryRun ? "read" : "read or written"}`,
        ]
      : []),
  ];
  if (problems.length > 0) {
    throw new CommandError(`${problems.join("; ")}. See the warnings above.`);
  }
}
