import chalk from "chalk";
import type { Command } from "commander";
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
import { resolveJournal } from "../content-journal";
import { undoRun } from "./actions";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const undoCmd = migrationsCommand
  .command("undo")
  .description("Undo a recorded content migration run")
  .option("-s, --space <space>", "space ID")
  .option("--run <id>", "the recorded run to undo; defaults to the most recent one");

undoCmd.action(async (_options: unknown, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const { space, path, run: requestedRun, verbose } = command.optsWithGlobals();
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
    const journal = resolveJournal({ path });

    let id = requestedRun;
    if (!id) {
      const runs = await journal.list(space);
      const latest = runs.at(-1);
      if (!latest) {
        throw new CommandError(`No migration runs recorded for space ${space}.`);
      }
      id = latest.id;
      // Named before anything is touched: an undo of the wrong run is not
      // something the next prompt can take back.
      ui.info(
        `Undoing the most recent run ${chalk.bold(id)} (${latest.title ?? latest.migration}).`,
      );
    } else {
      // A run id does not carry the space it belongs to, and the journal finds
      // an entry wherever it was recorded. Without this check, a run from
      // another space patches this one's stories by uid and the failures read
      // as content problems rather than as the addressing mistake they are.
      const entry = await journal.read(id);
      if (entry && entry.space !== space) {
        throw new CommandError(
          `Run ${id} was recorded for space ${entry.space}, not space ${space}. Undo it with --space ${entry.space}.`,
        );
      }
    }

    /** Story names are carried across the fetch so the write does not clear them. */
    const names = new Map<number, string | undefined>();

    const outcome = await undoRun({
      journal,
      id,
      fetchStory: async (storyId) => {
        const story = await fetchStory(space, storyId);
        if (!story) {
          throw new CommandError(`Story ${storyId} is no longer in space ${space}.`);
        }
        names.set(storyId, story.name);
        return {
          id: storyId,
          slug: story.full_slug ?? story.slug ?? String(storyId),
          content: story.content,
        };
      },
    });

    // The two reasons a block is not undone read differently to the person
    // holding them: a conflict is an edit worth looking at, a missing block is a
    // record that no longer addresses anything.
    for (const conflict of outcome.conflicts) {
      ui.warn(
        `${chalk.bold(conflict.slug)}: ${plural(conflict.count, "block", "blocks")} changed since the migration ran; left as ${conflict.count === 1 ? "it is" : "they are"}.`,
      );
    }

    for (const gone of outcome.missing) {
      ui.warn(
        `${chalk.bold(gone.slug)}: ${plural(gone.count, "block", "blocks")} recorded by the run ${gone.count === 1 ? "is" : "are"} no longer in this story; nothing to undo for ${gone.count === 1 ? "it" : "them"}.`,
      );
    }

    // Written one story at a time, and failures are reported rather than
    // thrown, so a run that fails partway leaves the stories it did undo undone
    // instead of abandoning the rest of the batch.
    let undone = 0;
    for (const write of outcome.writes) {
      if (!isRecord(write.content)) {
        continue;
      }
      try {
        await updateStory(space, write.story.id, {
          story: { content: write.content, name: names.get(write.story.id) },
          force_update: "1",
        });
        undone++;
        logger.info("Story undone", { storyId: write.story.id, run: id, space });
      } catch (maybeError) {
        const error = toError(maybeError);
        ui.warn(`${chalk.bold(write.story.slug)}: ${error.message}`);
        logger.error("Failed to undo story", { storyId: write.story.id, run: id, space, error });
      }
    }

    // Counted over stories rather than over reports: one story can hold both a
    // conflicting block and a missing one, and a story that was partly undone
    // was still written.
    const written = new Set(outcome.writes.map((write) => write.story.slug));
    const untouched = new Set(
      [...outcome.conflicts, ...outcome.missing]
        .map((report) => report.slug)
        .filter((slug) => !written.has(slug)),
    ).size;
    ui.info(
      `Undid ${plural(undone, "story", "stories")} of run ${chalk.bold(id)}${
        untouched > 0 ? `; ${plural(untouched, "story", "stories")} left unchanged.` : "."
      }`,
    );
  } catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }

  logger.info("Content migration undo finished", { space });
});
