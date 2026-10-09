import chalk from "chalk";
import type { Command } from "commander";
import { planUndo, undoStories } from "@storyblok/schema/migrations";
import type { StoryForMigration } from "@storyblok/schema/migrations";
import { colorPalette, commands } from "../../../constants";
import {
  CommandError,
  handleError,
  isRecord,
  requireAuthentication,
  toError,
} from "../../../utils";
import { APIError } from "../../../utils/error/api-error";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { fetchStory, updateStory } from "../../stories/actions";
import { migrationsCommand } from "../command";
import {
  contentJournal,
  guardPendingReleases,
  plural,
  toMigrationCommandError,
  toStoryForMigration,
} from "../content-migrations";

const undoCmd = migrationsCommand
  .command("undo")
  .description("Undo a recorded content migration run")
  .option("-s, --space <space>", "space ID")
  .option("--run <id>", "the recorded run to undo; defaults to the most recent one not yet undone")
  .option("--force", "overwrite blocks that were edited since the run")
  .option(
    "--allow-pending-releases",
    "run although releases are pending; their content is not restored",
  );

undoCmd.action(async (_options: unknown, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const {
    space,
    path,
    run: requestedRun,
    force,
    allowPendingReleases,
    verbose,
  } = command.optsWithGlobals();
  const { state } = session();

  ui.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, "Undoing a content migration run...");

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

  logger.info("Content migration undo started", { space, run: requestedRun });

  try {
    const journal = contentJournal(path);

    let id = requestedRun;
    if (!id) {
      const runs = await journal.list(space);
      const latest = runs.findLast((run) => !run.undoneAt);
      if (!latest) {
        throw new CommandError(
          runs.length === 0
            ? `No content migration runs recorded for space ${space}.`
            : `Every content migration run recorded for space ${space} is already undone.`,
        );
      }
      id = latest.id;
      // Named before anything is touched, so an undo of the wrong run is visible.
      ui.info(
        `Undoing the most recent run ${chalk.bold(id)} (${latest.title ?? latest.migration}).`,
      );
    }

    const plan = await planUndo({ journal, space, id });
    if (plan.run.undoneAt) {
      ui.info(`Run ${chalk.bold(id)} was already undone at ${plan.run.undoneAt}.`);
    }
    await guardPendingReleases(space, { allow: allowPendingReleases });

    /** Carried into the write, which would otherwise clear the story's name. */
    const names = new Map<number, string>();
    const stories: StoryForMigration[] = [];
    const deleted: number[] = [];
    let failed = 0;
    for (const storyId of plan.stories) {
      try {
        const story = await fetchStory(space, storyId);
        if (story?.deleted_at) {
          deleted.push(storyId);
        } else if (story) {
          names.set(storyId, story.name);
          stories.push(toStoryForMigration(story));
        }
      } catch (maybeError) {
        if (maybeError instanceof APIError && maybeError.errorId === "not_found") {
          deleted.push(storyId);
          continue;
        }
        failed++;
        const error = toError(maybeError);
        ui.warn(`Story ${storyId} could not be read, so it was not undone: ${error.message}`);
        logger.error("Failed to read story", { storyId, run: id, space, error });
      }
    }
    if (deleted.length > 0) {
      ui.warn(
        `${plural(deleted.length, "story was", "stories were")} deleted since the run, so there is nothing to undo there: ${deleted.join(", ")}`,
      );
    }

    const outcome = undoStories({ inverse: plan.inverse, stories, force });

    for (const conflict of outcome.conflicts) {
      ui.warn(
        force
          ? `${chalk.bold(conflict.slug)}: ${plural(conflict.count, "block was", "blocks were")} edited since the run and will be overwritten.`
          : `${chalk.bold(conflict.slug)}: ${plural(conflict.count, "block was", "blocks were")} edited since the run and ${conflict.count === 1 ? "is" : "are"} left as ${conflict.count === 1 ? "it is" : "they are"}. Pass --force to overwrite.`,
      );
    }
    for (const gone of outcome.missing) {
      ui.warn(
        `${chalk.bold(gone.slug)}: ${plural(gone.count, "block", "blocks")} the run changed ${gone.count === 1 ? "is" : "are"} no longer in the story; nothing to undo there.`,
      );
    }

    const restored = new Set<string>();
    for (const write of outcome.writes) {
      if (!isRecord(write.content)) {
        continue;
      }
      try {
        await updateStory(space, write.story.id, {
          story: { content: write.content, name: names.get(write.story.id) },
          force_update: "1",
          ...(write.publish ? { publish: 1 } : {}),
        });
        restored.add(write.story.slug);
        logger.info("Story undone", { storyId: write.story.id, run: id, space });
      } catch (maybeError) {
        failed++;
        const error = toError(maybeError);
        ui.warn(`${chalk.bold(write.story.slug)}: ${error.message}`);
        logger.error("Failed to undo story", { storyId: write.story.id, run: id, space, error });
      }
    }

    const notRepublished = outcome.notRepublished.filter((slug) => restored.has(slug));
    if (notRepublished.length > 0) {
      ui.warn(
        `The run published ${plural(notRepublished.length, "story", "stories")} that ${notRepublished.length === 1 ? "was" : "were"} edited or unpublished since, so only the draft was restored: ${notRepublished.join(", ")}`,
      );
    }
    const firstPublished = outcome.firstPublishedByRun.filter((slug) => restored.has(slug));
    if (firstPublished.length > 0) {
      const one = firstPublished.length === 1;
      ui.warn(
        `The run published ${plural(firstPublished.length, "story", "stories")} for the first time. The draft was restored, but ${one ? "it stays" : "they stay"} published. Unpublish any that shouldn't be live: ${firstPublished.join(", ")}`,
      );
    }

    const unchanged = plan.stories.length - restored.size - failed;
    ui.info(
      `Undid ${plural(restored.size, "story", "stories")} of run ${chalk.bold(id)}${
        unchanged > 0 ? `; ${plural(unchanged, "story", "stories")} left unchanged` : ""
      }${failed > 0 ? `; ${plural(failed, "story", "stories")} failed` : ""}.`,
    );

    if (failed > 0) {
      throw new CommandError(
        `${plural(failed, "story", "stories")} could not be undone. See the warnings above, then run the undo again with --run ${id}.`,
      );
    }
    // Blocks left in place keep the run open, so `undo --force` without --run
    // still reaches them.
    if (outcome.conflicts.length === 0 || force) {
      await journal.record({ ...plan.run, undoneAt: new Date().toISOString() }, plan.inverse);
    }
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Content migration undo finished", { space });
});
