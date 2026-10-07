import chalk from "chalk";
import type { Command } from "commander";
import {
  applyMigration,
  discoverMigrations,
  loadMigrations,
  validateMigration,
} from "@storyblok/schema/migrations";
import type {
  ApplyMigrationOutcome,
  CompiledMigration,
  PublishMode,
  StoryForMigration,
} from "@storyblok/schema/migrations";
import { colorPalette, commands } from "../../../constants";
import {
  CommandError,
  fetchAllPages,
  handleError,
  requireAuthentication,
  toError,
} from "../../../utils";
import { handleAPIError } from "../../../utils/error/api-error";
import { importUserModuleDefault } from "../../../utils/user-module";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { loadSchemaEntry } from "../../../lib/validation/adapter";
import { getMapiClient } from "../../../api";
import { session } from "../../../session";
import { fetchStory, updateStory } from "../../stories/actions";
import { migrationsCommand } from "../command";
import {
  contentJournal,
  guardPendingReleases,
  migrationsDirectory,
  plural,
  toMigrationCommandError,
  toStoryForMigration,
} from "../content-migrations";

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
  names: Map<number, string>,
): Promise<{ stories: StoryForMigration[]; unread: number }> {
  const stories = new Map(planned);
  let unread = 0;
  for (const id of candidates) {
    if (stories.has(id)) {
      continue;
    }
    try {
      const story = await fetchStory(space, id);
      if (story) {
        names.set(id, story.name);
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

function assertMatchesSchema(
  migration: CompiledMigration,
  id: string,
  schema: Parameters<typeof validateMigration>[1],
): void {
  const issues = validateMigration(migration, schema);
  if (issues.length > 0) {
    throw new CommandError(
      `${id} does not match the schema:\n${issues
        .map((issue) => `  - op ${issue.op}: ${issue.message}`)
        .join("\n")}`,
    );
  }
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

    if (schemaEntry) {
      // Each migration expects the schema as it stood before it, so one schema
      // can only describe the first of several.
      if (selected.length > 1) {
        throw new CommandError(
          `--schema checks one migration against the schema as it stood before that migration. Name the migration to check, for example: storyblok migrations apply ${selected[0].id} --schema ${schemaEntry}`,
        );
      }
      const { schema } = await loadSchemaEntry(schemaEntry, { requireBlocks: true });
      assertMatchesSchema(selected[0].migration, selected[0].id, schema);
    }

    await guardPendingReleases(space, { allow: allowPendingReleases, warnOnly: dryRun });

    const journal = contentJournal(path);
    const planned = new Map<number, StoryForMigration>();
    /** Carried into the write, which would otherwise clear the story's name. */
    const names = new Map<number, string>();
    const refusedEverything: string[] = [];
    let failed = 0;

    for (const entry of selected) {
      const spinner = ui.createSpinner(`${entry.id}: fetching stories...`);
      const candidates = await findCandidateStories(space, entry.migration.targets);
      const { stories, unread } = await readStories(space, candidates, planned, names);
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
          `${entry.id}: would change ${plural(outcome.run.stories, "story", "stories")} (${plural(outcome.run.blocks, "block", "blocks")}).`,
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
          await updateStory(space, write.story.id, {
            story: { content: write.content, name: names.get(write.story.id) },
            force_update: "1",
            ...(write.publish ? { publish: 1 } : {}),
          });
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

      if (landed.size < outcome.writes.length) {
        const recorded = outcome.inverse.filter((item) => landed.has(item.story));
        await journal.record(
          {
            ...outcome.run,
            stories: recorded.length,
            blocks: recorded.reduce((total, item) => total + item.patches.length, 0),
          },
          recorded,
        );
      }
      ui.info(
        `${entry.id}: changed ${plural(landed.size, "story", "stories")}, recorded as ${chalk.bold(outcome.run.id)}.`,
      );
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
