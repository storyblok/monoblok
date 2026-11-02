import type { Command } from "commander";
import { discoverMigrations } from "@storyblok/schema";
import type { MigrationRun } from "@storyblok/schema";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { migrationsCommand } from "../command";
import {
  contentJournal,
  migrationsDirectory,
  plural,
  toMigrationCommandError,
} from "../content-migrations";

const listCmd = migrationsCommand
  .command("list")
  .description(
    "List the content migration runs recorded for a space on this machine, then the migrations without one",
  )
  .option("-s, --space <space>", "space ID")
  .option("--pending", "List only the migrations without a recorded run that is still in place");

function undoState(run: MigrationRun): string {
  if (run.undoneAt) return `  (undone ${run.undoneAt})`;
  if (run.partlyUndoneAt) return `  (partly undone ${run.partlyUndoneAt})`;
  if (run.interrupted) return "  (interrupted)";
  return "";
}

/**
 * The migration files with no run still in place. The journal records runs on
 * this machine only, so a migration another machine applied is pending here.
 */
function pendingMigrations(ids: readonly string[], runs: readonly MigrationRun[]): string[] {
  const inPlace = new Set(runs.filter((run) => !run.undoneAt).map((run) => run.migration));
  return ids.filter((id) => !inPlace.has(id));
}

listCmd.action(async (options: { pending?: boolean }, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const { space, path, verbose } = command.optsWithGlobals();

  ui.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, "Listing content migration runs...");

  if (!space) {
    handleError(
      new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`),
      verbose,
    );
    return;
  }

  logger.info("Content migration list started", { space });

  try {
    const runs = await contentJournal(path).list(space);
    const files = await discoverMigrations(migrationsDirectory(path, space));
    const pending = pendingMigrations(
      files.map((file) => file.id),
      runs,
    );

    if (options.pending) {
      if (pending.length === 0) {
        ui.info("No pending content migrations for this space on this machine.");
      }
      for (const id of pending) {
        ui.info(id);
      }
      return;
    }

    if (runs.length === 0) {
      ui.info("No content migration runs recorded for this space.");
    }
    for (const run of runs) {
      ui.info(
        `${run.id}  ${run.title ?? run.migration}  ${plural(run.stories, "story", "stories")}, ${plural(run.blocks, "block", "blocks")}${undoState(run)}`,
      );
    }
    if (pending.length > 0) {
      ui.info(`Pending on this machine: ${pending.join(", ")}`);
    }
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Content migration list finished", { space });
});
