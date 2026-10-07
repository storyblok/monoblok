import chalk from "chalk";
import type { Command } from "commander";
import { applyMigration, loadMigrations, validateMigration } from "@storyblok/schema/migrations";
import type {
  CompiledMigration,
  PublishMode,
  StoryForMigration,
  StoryInverse,
} from "@storyblok/schema/migrations";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication, toError } from "../../../utils";
import { importUserModuleDefault } from "../../../utils/user-module";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { loadSchemaEntry } from "../../../lib/validation/adapter";
import { session } from "../../../session";
import { fetchStories, fetchStory, updateStory } from "../../stories/actions";
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

function isPublishMode(value: unknown): value is PublishMode {
  return PUBLISH_MODES.some((mode) => mode === value);
}

/**
 * The ids of the stories that contain at least one block the migration targets,
 * so the content fetch scales with the blocks it names, not with the space.
 */
async function findCandidateStories(space: string, targets: readonly string[]): Promise<number[]> {
  const ids = new Set<number>();

  for (const component of targets) {
    for (let page = 1; ; page++) {
      const result = await fetchStories(space, {
        contain_component: component,
        per_page: PER_PAGE,
        page,
        story_only: true,
      });
      if (!result) {
        break;
      }
      for (const story of result.stories) {
        ids.add(story.id);
      }
      const total = Number(result.headers.get("Total"));
      const perPage = Number(result.headers.get("Per-Page")) || PER_PAGE;
      if (!Number.isFinite(total) || page * perPage >= total) {
        break;
      }
    }
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
): Promise<StoryForMigration[]> {
  const stories = new Map(planned);
  for (const id of candidates) {
    if (stories.has(id)) {
      continue;
    }
    const story = await fetchStory(space, id);
    if (story) {
      names.set(id, story.name);
      stories.set(id, toStoryForMigration(story));
    }
  }
  return [...stories.values()];
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

const applyCmd = migrationsCommand
  .command("apply [name]")
  .description("Apply content migrations and record each run so it can be undone")
  .option("-s, --space <space>", "space ID")
  .option("-d, --dry-run", "report what would change without writing")
  .option(
    "--schema <entry-file>",
    "schema entry file to check the migrations' blocks and fields against before applying",
  )
  .option(
    "--publish <publish>",
    "publish the migrated stories: all | published | published-with-changes",
  )
  .option(
    "--allow-pending-releases",
    "run although releases are pending; their content is not migrated",
  );

applyCmd.action(async (name: string | undefined, _options: unknown, command: Command) => {
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
    const loaded = await loadMigrations(directory, (file) =>
      importUserModuleDefault(file, "migration file"),
    );
    const selected = name ? loaded.filter((entry) => entry.id === name) : loaded;

    if (selected.length === 0) {
      throw new CommandError(
        name
          ? `No content migration "${name}" in ${directory}.`
          : `No content migrations found in ${directory}.`,
      );
    }

    if (schemaEntry) {
      const { schema } = await loadSchemaEntry(schemaEntry, { requireBlocks: true });
      for (const entry of selected) {
        assertMatchesSchema(entry.migration, entry.id, schema);
      }
    }

    await guardPendingReleases(space, { allow: allowPendingReleases, warnOnly: dryRun });

    const journal = contentJournal(path);
    const planned = new Map<number, StoryForMigration>();
    /** Carried into the write, which would otherwise clear the story's name. */
    const names = new Map<number, string>();
    // Counted across the whole invocation: the exit code is one answer for it.
    let refused = 0;
    let written = 0;

    for (const entry of selected) {
      const spinner = ui.createSpinner(`${entry.id}: fetching stories...`);
      const candidates = await findCandidateStories(space, entry.migration.targets);
      const stories = await readStories(space, candidates, planned, names);
      spinner.succeed(
        `${entry.id}: ${plural(stories.length, "story contains", "stories contain")} ${entry.migration.targets.join(", ")}`,
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
      refused += outcome.refusals.length;

      if (outcome.publishedDraftOnly > 0) {
        ui.warn(
          `${entry.id}: ${plural(outcome.publishedDraftOnly, "published story", "published stories")} ${dryRun ? "would be" : "were"} migrated as a draft only. The published version keeps the old content until the story is published again; pass --publish to publish it with the migration.`,
        );
      }

      if (dryRun) {
        for (const write of outcome.writes) {
          planned.set(write.story.id, { ...write.story, content: write.content });
        }
        written += outcome.writes.length;
        ui.info(
          `${entry.id}: would change ${plural(outcome.run.stories, "story", "stories")} (${plural(outcome.run.blocks, "block", "blocks")}).`,
        );
        continue;
      }

      const inverseByStory = new Map(outcome.inverse.map((item) => [item.story, item]));
      // Only stories that were written go into the record, so a run that fails
      // partway can still undo the part that landed.
      const recorded: StoryInverse[] = [];

      for (const write of outcome.writes) {
        try {
          await updateStory(space, write.story.id, {
            story: { content: write.content, name: names.get(write.story.id) },
            force_update: "1",
            ...(write.publish ? { publish: 1 } : {}),
          });
          const item = inverseByStory.get(write.story.id);
          if (item) {
            recorded.push(item);
          }
          logger.info("Story migrated", { storyId: write.story.id, migration: entry.id, space });
        } catch (maybeError) {
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

      written += recorded.length;

      // An empty entry would become the most recent run, which `undo` picks by
      // default, and undoing it would leave the real work applied.
      if (recorded.length === 0) {
        ui.info(`${entry.id}: changed no stories, so nothing was recorded.`);
        continue;
      }

      await journal.record(
        {
          ...outcome.run,
          stories: recorded.length,
          blocks: recorded.reduce((total, item) => total + item.patches.length, 0),
        },
        recorded,
      );
      ui.info(
        `${entry.id}: changed ${plural(recorded.length, "story", "stories")}, recorded as ${chalk.bold(outcome.run.id)}.`,
      );
    }

    // A partial run exits successfully: it wrote what it could and recorded an
    // undo for it. Only a run that achieved nothing fails.
    if (refused > 0 && written === 0) {
      throw new CommandError(
        `Every story the migration matched was refused; nothing was ${dryRun ? "planned" : "written"}.`,
      );
    }
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Content migration apply finished", { space });
});
