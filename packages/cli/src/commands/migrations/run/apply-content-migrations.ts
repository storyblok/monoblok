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

function changeSummary(run: MigrationRun): string {
  return `${plural(run.stories, "story", "stories")} (${plural(run.blocks, "block", "blocks")})`;
}

/**
 * The stories of one command run, each read at most once and kept up to date
 * with what the run's earlier migrations changed, so a later migration sees an
 * earlier one's output.
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
    /**
     * What a migration changed. The publish state stays as it was read: the run
     * writes each story once, after its last migration, so every migration
     * decides about publishing from the same state.
     */
    planned(story: StoryForMigration, content: Record<string, unknown>): void {
      changed.add(story.id);
      known.set(story.id, { ...story, content });
    },
  };
}

/** The one write a story gets, holding what every migration of the run changed. */
type StoryWrite = {
  story: StoryForMigration;
  content: Record<string, unknown>;
  publish: boolean;
  migrations: string[];
};

/**
 * Collects each story's write across migrations: the content the last one left,
 * published when any of them publishes.
 */
function storyWrites() {
  const byStory = new Map<number, StoryWrite>();
  return {
    add(id: string, outcome: ApplyMigrationOutcome): void {
      for (const write of outcome.writes) {
        const known = byStory.get(write.story.id);
        byStory.set(write.story.id, {
          story: known?.story ?? write.story,
          content: write.content,
          publish: (known?.publish ?? false) || write.publish,
          migrations: [...(known?.migrations ?? []), id],
        });
      }
    },
    all: (): StoryWrite[] => [...byStory.values()],
  };
}

/**
 * The next run's time, later than the previous one's, so run ids, which sort
 * by time, keep the order the migrations ran in.
 */
function nextAppliedAt(previous: Date | undefined): Date {
  const now = new Date();
  return previous && now.getTime() <= previous.getTime() ? new Date(previous.getTime() + 1) : now;
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
    const { nameOnlyBlocks } = await loadSchemaModule(snapshot);
    return {
      entry,
      schema,
      nameOnlyBlocks: isStringArray(nameOnlyBlocks) ? nameOnlyBlocks : undefined,
    };
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
    assertMatchesSchemas([{ entry: migrations[0], schema }]);
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
 * back. Every migration runs in memory first, so a story several of them change
 * is written once. Throws a {@link CommandError} naming every problem once all
 * migrations ran.
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

  const journal = contentJournal(path);
  const access = storyAccess(space);
  const cache = storyCache(space, access);
  const writes = storyWrites();
  /** Migrations that changed at least one story, in the order they ran. */
  const applied: { id: string; outcome: ApplyMigrationOutcome }[] = [];
  const refusedEverything: string[] = [];
  let failed = 0;
  let appliedAt: Date | undefined;

  for (const entry of selected) {
    const spinner = ui.createSpinner(`${entry.id}: fetching stories...`);
    const candidates = await findCandidateStories(space, entry.migration.targets, scope);
    const { stories, unread } = await cache.storiesFor(candidates);
    failed += unread;
    spinner.succeed(
      `${entry.id}: ${plural(candidates.length, "story contains", "stories contain")} ${entry.migration.targets.join(", ")}`,
    );

    appliedAt = nextAppliedAt(appliedAt);
    const outcome = applyMigration({
      migration: entry.migration,
      id: entry.id,
      space,
      stories,
      publish,
      appliedAt,
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

    for (const write of outcome.writes) {
      cache.planned(write.story, write.content);
    }
    writes.add(entry.id, outcome);

    if (dryRun) {
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
      ui.info(`${entry.id}: changed no stories, so nothing was recorded.`);
      continue;
    }
    applied.push({ id: entry.id, outcome });
  }

  const notPublished: string[] = [];
  if (!dryRun && applied.length > 0) {
    // Recorded before the first write, so a run that stops partway can still
    // be rolled back. A rollback skips stories whose content never changed.
    for (const { outcome } of applied) {
      await journal.record({ ...outcome.run, interrupted: true }, outcome.inverse);
    }

    /** Whether each story's write landed published, by story id. */
    const landed = new Map<number, boolean>();
    for (const write of writes.all()) {
      const context = { storyId: write.story.id, migrations: write.migrations, space };
      try {
        await access.write(write.story.id, write.content, write.publish);
        landed.set(write.story.id, write.publish);
        logger.info("Story migrated", context);
      } catch (maybeError) {
        // The draft changed, so the runs record it and a rollback can restore it.
        if (maybeError instanceof DraftNotPublishedError) {
          landed.set(write.story.id, false);
          notPublished.push(write.story.slug);
          ui.warn(
            `${chalk.bold(write.story.slug)}: the draft was migrated, but publishing it failed: ${maybeError.message}`,
          );
          logger.error("Failed to publish migrated story", { ...context, error: maybeError });
          continue;
        }
        failed++;
        const error = toError(maybeError);
        ui.warn(`${chalk.bold(write.story.slug)} could not be written: ${error.message}`);
        logger.error("Failed to migrate story", { ...context, error });
      }
    }

    for (const { id, outcome } of applied) {
      const landedWrites: LandedWrite[] = outcome.writes.flatMap((write) => {
        const published = landed.get(write.story.id);
        return published === undefined ? [] : [{ story: write.story.id, published }];
      });
      // An entry for a run that changed nothing would become the most recent
      // run, which `rollback` picks by default, leaving the real work applied.
      if (landedWrites.length === 0) {
        await journal.remove(outcome.run.id);
        ui.info(`${id}: changed no stories, so nothing was recorded.`);
        continue;
      }
      const { run, inverse } = settleRun(outcome, landedWrites);
      await journal.record(run, inverse);
      ui.info(`${id}: changed ${changeSummary(run)}, recorded as ${chalk.bold(run.id)}.`);
    }
  }

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
