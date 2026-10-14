import chalk from "chalk";
import type { Command } from "commander";
import { relative } from "pathe";
import {
  applyMigration,
  discoverMigrations,
  loadMigrations,
  validateMigration,
} from "@storyblok/schema/migrations";
import type {
  ApplyMigrationOutcome,
  LoadedMigration,
  MigrationRun,
  PublishMode,
  StoryForMigration,
} from "@storyblok/schema/migrations";
import type { SchemaLike } from "@storyblok/schema";
import { colorPalette, commands } from "../../../constants";
import {
  CommandError,
  fetchAllPages,
  handleError,
  requireAuthentication,
  toError,
} from "../../../utils";
import { handleAPIError } from "../../../utils/error/api-error";
import { fileExists } from "../../../utils/filesystem";
import { importUserModuleDefault } from "../../../utils/user-module";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { loadSchemaEntry } from "../../../lib/validation/adapter";
import { loadSchemaModule } from "../../../utils/schema/classify-exports";
import { getMapiClient } from "../../../api";
import { session } from "../../../session";
import { migrationsCommand } from "../command";
import {
  contentJournal,
  guardPendingReleases,
  migrationsDirectory,
  plural,
  storyAccess,
  toMigrationCommandError,
  toStoryForMigration,
} from "../content-migrations";
import type { StoryAccess } from "../content-migrations";

const PER_PAGE = 100;
const PUBLISH_MODES: readonly PublishMode[] = ["all", "published", "published-with-changes"];
/** Lets a migration be named by its filename, as shell completion produces it. */
const MIGRATION_EXTENSION = /\.(?:ts|js|mjs)$/;

function isPublishMode(value: unknown): value is PublishMode {
  return PUBLISH_MODES.some((mode) => mode === value);
}

/**
 * The ids of the stories that contain at least one block the migration targets,
 * so the content fetch scales with the blocks it names, not with the space.
 */
async function findCandidateStories(space: string, targets: readonly string[]): Promise<number[]> {
  const client = getMapiClient();
  const ids = new Set<number>();

  try {
    for (const component of targets) {
      const stories = await fetchAllPages(
        (page) =>
          client.stories.list({
            path: { space_id: Number(space) },
            query: { contain_component: component, per_page: PER_PAGE, page, story_only: true },
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
 * The stories one migration runs against. `planned` holds content an earlier
 * migration in the same dry run would have written. It is passed in whole, not
 * filtered by target: the API only matches the content it holds, so a block an
 * earlier migration renamed or created is invisible to it, and the engine skips
 * any story the migration leaves unchanged anyway.
 */
async function readStories(
  space: string,
  candidates: number[],
  planned: Map<number, StoryForMigration>,
  access: StoryAccess,
): Promise<{ stories: StoryForMigration[]; unread: number }> {
  const stories = new Map(planned);
  let unread = 0;
  for (const id of candidates) {
    if (stories.has(id)) {
      continue;
    }
    try {
      const story = await access.read(id);
      if (story) {
        stories.set(id, toStoryForMigration(story));
      }
    } catch (maybeError) {
      unread++;
      const error = toError(maybeError);
      getUI().warn(`Story ${id} could not be read, so it was not migrated: ${error.message}`);
      getLogger().error("Failed to read story", { storyId: id, space, error });
    }
  }
  return { stories: [...stories.values()], unread };
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

const applyCmd = migrationsCommand
  .command("apply [name]")
  .description("Apply content migrations and record each run so it can be undone")
  .option("-s, --space <space>", "space ID")
  .option("-d, --dry-run", "report what would change without writing")
  .option(
    "--schema <entry-file>",
    "schema entry file, as it stood before the migration, to check the migration's blocks and fields against",
  )
  .option("--no-validate", "skip checking each migration against its .before.ts schema snapshot")
  .option(
    "--publish <publish>",
    "publish the migrated stories: all | published | published-with-changes",
  )
  .option(
    "--allow-pending-releases",
    "run although releases are pending; their content is not migrated",
  );

applyCmd.action(async (rawName: string | undefined, _options: unknown, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const {
    space,
    path,
    dryRun,
    schema: schemaEntry,
    validate,
    publish,
    allowPendingReleases,
    verbose,
  } = command.optsWithGlobals();
  const { state } = session();
  const name = rawName?.replace(MIGRATION_EXTENSION, "");

  ui.title(
    `${commands.MIGRATIONS}`,
    colorPalette.MIGRATIONS,
    name ? `Applying content migration ${name}...` : "Applying content migrations...",
  );

  if (!requireAuthentication(state, verbose)) {
    return;
  }

  if (!space) {
    handleError(
      new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`),
      verbose,
    );
    return;
  }

  if (publish !== undefined && !isPublishMode(publish)) {
    handleError(
      new CommandError(`Invalid --publish "${publish}". Use one of: ${PUBLISH_MODES.join(", ")}.`),
      verbose,
    );
    return;
  }

  if (dryRun) {
    ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
  }

  logger.info("Content migration apply started", { name, space, dryRun: Boolean(dryRun) });

  try {
    const directory = migrationsDirectory(path, space);
    const selected = await loadMigrations(
      directory,
      (file) => importUserModuleDefault(file, "migration file"),
      { only: name },
    );

    if (selected.length === 0) {
      if (!name) {
        throw new CommandError(`No content migrations found in ${directory}.`);
      }
      const available = (await discoverMigrations(directory)).map((entry) => entry.id);
      throw new CommandError(
        `No content migration "${name}" in ${directory}.${
          available.length > 0 ? ` Available: ${available.join(", ")}.` : ""
        }`,
      );
    }

    if (schemaEntry && !validate) {
      throw new CommandError("Pass either --schema or --no-validate, not both.");
    }

    if (schemaEntry) {
      // Each migration expects the schema as it stood before it, so one schema
      // can only describe the first of several.
      if (selected.length > 1) {
        throw new CommandError(
          `--schema checks one migration against the schema as it stood before that migration. Name the migration to check, for example: storyblok migrations apply ${selected[0].id} --schema ${schemaEntry}`,
        );
      }
      const { schema } = await loadSchemaEntry(schemaEntry, { requireBlocks: true });
      assertMatchesSchemas([{ entry: selected[0], schema }]);
    } else if (validate) {
      const unchecked = await assertMatchesSnapshots(selected);
      if (unchecked.length > 0) {
        ui.warn(
          `Not checked against a schema, because no .before.ts snapshot sits beside ${unchecked.length === 1 ? "it" : "them"}: ${unchecked.join(", ")}. Name a migration and pass --schema to check it against a schema entry file.`,
        );
      }
    }

    await guardPendingReleases(space, { allow: allowPendingReleases, warnOnly: dryRun });

    const journal = contentJournal(path);
    const planned = new Map<number, StoryForMigration>();
    const access = storyAccess(space);
    const refusedEverything: string[] = [];
    let failed = 0;

    for (const entry of selected) {
      const spinner = ui.createSpinner(`${entry.id}: fetching stories...`);
      const candidates = await findCandidateStories(space, entry.migration.targets);
      const { stories, unread } = await readStories(space, candidates, planned, access);
      failed += unread;
      spinner.succeed(
        `${entry.id}: ${plural(candidates.length, "story contains", "stories contain")} ${entry.migration.targets.join(", ")}`,
      );

      const outcome = applyMigration({
        migration: entry.migration,
        id: entry.id,
        space,
        stories,
        publish,
      });

      for (const refusal of outcome.refusals) {
        ui.warn(`${chalk.bold(refusal.slug)}: ${refusal.reason}`);
      }
      if (outcome.refusals.length > 0 && outcome.writes.length === 0) {
        refusedEverything.push(entry.id);
      }

      warnPublishedDraftOnly(entry.id, outcome, { dryRun: Boolean(dryRun), publish });

      if (dryRun) {
        for (const write of outcome.writes) {
          planned.set(write.story.id, { ...write.story, content: write.content });
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
        ui.info(`${entry.id}: changed no stories, so nothing was recorded.`);
        continue;
      }

      // Recorded before the first write, so a run that stops partway can still
      // be undone. Undo skips stories whose content never changed.
      await journal.record(outcome.run, outcome.inverse);

      const landed = new Set<number>();
      for (const write of outcome.writes) {
        try {
          await access.write(write.story.id, write.content, write.publish);
          landed.add(write.story.id);
          logger.info("Story migrated", { storyId: write.story.id, migration: entry.id, space });
        } catch (maybeError) {
          failed++;
          const error = toError(maybeError);
          ui.warn(`${chalk.bold(write.story.slug)}: ${error.message}`);
          logger.error("Failed to migrate story", {
            storyId: write.story.id,
            migration: entry.id,
            space,
            error,
          });
        }
      }

      // An entry for a run that changed nothing would become the most recent
      // run, which `undo` picks by default, leaving the real work applied.
      if (landed.size === 0) {
        await journal.remove(outcome.run.id);
        ui.info(`${entry.id}: changed no stories, so nothing was recorded.`);
        continue;
      }

      let run = outcome.run;
      if (landed.size < outcome.writes.length) {
        const recorded = outcome.inverse.filter((item) => landed.has(item.story));
        run = {
          ...outcome.run,
          stories: recorded.length,
          blocks: recorded.reduce((total, item) => total + item.patches.length, 0),
        };
        await journal.record(run, recorded);
      }
      ui.info(`${entry.id}: changed ${changeSummary(run)}, recorded as ${chalk.bold(run.id)}.`);
    }

    const problems = [
      ...refusedEverything.map((id) => `${id} refused every story it matched`),
      ...(failed > 0
        ? [
            `${plural(failed, "story", "stories")} could not be ${dryRun ? "read" : "read or written"}`,
          ]
        : []),
    ];
    if (problems.length > 0) {
      throw new CommandError(`${problems.join("; ")}. See the warnings above.`);
    }
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Content migration apply finished", { space });
});
