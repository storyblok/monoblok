import chalk from "chalk";
import type { Command } from "commander";
import { blockComponents, runId, validateMigration } from "@storyblok/schema/migrations";
import type { CompiledMigration, StoryInverse } from "@storyblok/schema/migrations";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication, toError } from "../../../utils";
import { resolvePath } from "../../../utils/filesystem";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { loadSchemaEntry } from "../../../lib/validation/adapter";
import type { SchemaLike } from "../../../lib/validation/adapter";
import { session } from "../../../session";
import { fetchStories, fetchStory, updateStory } from "../../stories/actions";
import { migrationsCommand } from "../command";
import { resolveJournal } from "../content-journal";
import { loadMigrations } from "../load-migrations";
import { applyMigration, type StoryForMigration } from "./actions";

const PER_PAGE = 100;

type CandidateStory = { id: number; slug: string; name: string };

/**
 * The stories a migration could possibly change: those that contain at least
 * one of the blocks it targets. Narrowing the set here rather than in
 * {@link applyMigration} keeps the content fetch proportional to the blocks the
 * migration names instead of to the size of the space.
 */
async function findCandidateStories(
  space: string,
  targets: readonly string[],
): Promise<CandidateStory[]> {
  const byId = new Map<number, CandidateStory>();

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
        byId.set(story.id, {
          id: story.id,
          slug: story.full_slug ?? story.slug ?? String(story.id),
          name: story.name,
        });
      }
      const total = Number(result.headers.get("Total"));
      const perPage = Number(result.headers.get("Per-Page")) || PER_PAGE;
      if (!Number.isFinite(total) || page * perPage >= total) {
        break;
      }
    }
  }

  return [...byId.values()];
}

/**
 * The stories one migration runs against.
 *
 * `planned` holds content an earlier migration in the same invocation would have
 * written but, under a dry run, did not. Without it a dry run of several
 * migrations reads pre-migration content from the API, and a migration that
 * targets a block an earlier one renames or creates finds no story at all: the
 * dry run would report no work for something a real run does.
 */
async function readStoriesWithContent(
  space: string,
  candidates: CandidateStory[],
  targets: readonly string[],
  planned: Map<number, StoryForMigration>,
): Promise<StoryForMigration[]> {
  const byId = new Map<number, StoryForMigration>();

  for (const candidate of candidates) {
    const carried = planned.get(candidate.id);
    if (carried) {
      byId.set(candidate.id, carried);
      continue;
    }
    const story = await fetchStory(space, candidate.id);
    if (story) {
      byId.set(candidate.id, { id: candidate.id, slug: candidate.slug, content: story.content });
    }
  }

  // The API filters on the content it holds, so a story that only contains a
  // target block in its planned content is not among the candidates.
  for (const [id, story] of planned) {
    if (!byId.has(id) && blockComponents(story.content).some((name) => targets.includes(name))) {
      byId.set(id, story);
    }
  }

  return [...byId.values()];
}

function assertMigrationMatchesSchema(
  migration: CompiledMigration,
  id: string,
  schema: SchemaLike,
): void {
  const issues = validateMigration(migration, schema);
  if (issues.length === 0) {
    return;
  }
  throw new CommandError(
    `${id} does not match the schema:\n${issues
      .map((issue) => `  - op ${issue.op}: ${issue.message}`)
      .join("\n")}`,
  );
}

const applyCmd = migrationsCommand
  .command("apply [name]")
  .description("Apply a content migration and record the run so it can be undone")
  .option("-s, --space <space>", "space ID")
  .option("-d, --dry-run", "report what would change without writing")
  .option(
    "--schema <entry-file>",
    "schema entry file to check the migration's blocks and fields against before applying",
  );

applyCmd.action(async (name: string | undefined, _options: unknown, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const { space, path: basePath, dryRun, schema: schemaEntry, verbose } = command.optsWithGlobals();
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

  if (dryRun) {
    ui.warn(`DRY RUN MODE ENABLED: No changes will be made.\n`);
  }

  logger.info("Content migration apply started", { name, space, dryRun: Boolean(dryRun) });

  try {
    const directory = resolvePath(basePath, `migrations/${space}`);
    const loaded = await loadMigrations(directory);
    const selected = name ? loaded.filter((entry) => entry.id === name) : loaded;

    if (selected.length === 0) {
      throw new CommandError(
        name
          ? `No migration "${name}" in ${directory}.`
          : `No content migrations found in ${directory}.`,
      );
    }

    if (schemaEntry) {
      const { schema } = await loadSchemaEntry(schemaEntry, { requireBlocks: true });
      for (const entry of selected) {
        assertMigrationMatchesSchema(entry.migration, entry.id, schema);
      }
    }

    const journal = resolveJournal({ path: basePath });
    const planned = new Map<number, StoryForMigration>();
    const names = new Map<number, string>();

    for (const entry of selected) {
      const spinner = ui.createSpinner(`${entry.id}: fetching stories...`);
      const candidates = await findCandidateStories(space, entry.migration.targets);
      for (const candidate of candidates) {
        names.set(candidate.id, candidate.name);
      }
      const stories = await readStoriesWithContent(
        space,
        candidates,
        entry.migration.targets,
        planned,
      );
      spinner.succeed(
        `${entry.id}: ${stories.length} ${stories.length === 1 ? "story contains" : "stories contain"} ${entry.migration.targets.join(", ")}`,
      );

      const outcome = await applyMigration({
        migration: entry.migration,
        id: entry.id,
        space,
        stories,
      });

      for (const refusal of outcome.refusals) {
        ui.warn(`${chalk.bold(refusal.slug)}: ${refusal.reason}`);
      }

      if (dryRun) {
        for (const write of outcome.writes) {
          planned.set(write.story.id, { ...write.story, content: write.content });
        }
        ui.info(
          `${entry.id}: would change ${outcome.run.stories} ${outcome.run.stories === 1 ? "story" : "stories"} (${outcome.run.blocks} blocks).`,
        );
        continue;
      }

      const inverseByStory = new Map(outcome.inverse.map((item) => [item.story, item]));
      // Only the stories that were actually written go into the record. A run
      // that half-succeeded must still leave a usable undo for the half that
      // landed, and must not claim an undo for a story it never touched.
      const recorded: StoryInverse[] = [];

      for (const write of outcome.writes) {
        try {
          await updateStory(space, write.story.id, {
            story: { content: write.content, name: names.get(write.story.id) },
            force_update: "1",
          });
          const item = inverseByStory.get(String(write.story.id));
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

      const id = runId(entry.id);
      await journal.record(
        {
          ...outcome.run,
          id,
          stories: recorded.length,
          blocks: recorded.reduce((total, item) => total + item.patches.length, 0),
        },
        recorded,
      );
      ui.info(
        `${entry.id}: changed ${recorded.length} ${recorded.length === 1 ? "story" : "stories"}, recorded as ${chalk.bold(id)}.`,
      );
    }
  } catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }

  logger.info("Content migration apply finished", { space });
});
