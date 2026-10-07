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
  .option("--run <id>", "the recorded run to undo; defaults to the most recent one")
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
      const latest = (await journal.list(space)).at(-1);
      if (!latest) {
        throw new CommandError(`No content migration runs recorded for space ${space}.`);
      }
      id = latest.id;
      // Named before anything is touched, so an undo of the wrong run is visible.
      ui.info(
        `Undoing the most recent run ${chalk.bold(id)} (${latest.title ?? latest.migration}).`,
      );
    }

    const plan = await planUndo({ journal, space, id });
    await guardPendingReleases(space, { allow: allowPendingReleases });

    /** Carried into the write, which would otherwise clear the story's name. */
    const names = new Map<number, string>();
    const stories: StoryForMigration[] = [];
    for (const storyId of plan.stories) {
      try {
        const story = await fetchStory(space, storyId);
        if (story) {
          names.set(storyId, story.name);
          stories.push(toStoryForMigration(story));
        }
      } catch (maybeError) {
        // Left out of `stories`, the engine reports it as unread.
        logger.error("Failed to read story", {
          storyId,
          run: id,
          space,
          error: toError(maybeError),
        });
      }
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
    for (const storyId of outcome.unread) {
      ui.warn(`Story ${storyId} could not be read, so it was not undone.`);
    }

    let undone = 0;
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
        undone++;
        logger.info("Story undone", { storyId: write.story.id, run: id, space });
      } catch (maybeError) {
        const error = toError(maybeError);
        ui.warn(`${chalk.bold(write.story.slug)}: ${error.message}`);
        logger.error("Failed to undo story", { storyId: write.story.id, run: id, space, error });
      }
    }

    if (outcome.notRepublished.length > 0) {
      ui.warn(
        `The run published ${plural(outcome.notRepublished.length, "story", "stories")} that ${outcome.notRepublished.length === 1 ? "was" : "were"} edited or unpublished since, so only the draft was restored: ${outcome.notRepublished.join(", ")}`,
      );
    }
    if (outcome.firstPublishedByRun.length > 0) {
      ui.warn(
        `The run published ${plural(outcome.firstPublishedByRun.length, "story", "stories")} for the first time. The draft was restored, but ${outcome.firstPublishedByRun.length === 1 ? "it stays" : "they stay"} published; unpublish ${outcome.firstPublishedByRun.length === 1 ? "it" : "them"} if needed: ${outcome.firstPublishedByRun.join(", ")}`,
      );
    }

    const untouched = plan.stories.length - outcome.writes.length;
    ui.info(
      `Undid ${plural(undone, "story", "stories")} of run ${chalk.bold(id)}${
        untouched > 0 ? `; ${plural(untouched, "story", "stories")} left unchanged.` : "."
      }`,
    );
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Content migration undo finished", { space });
});
