import type { Command } from "commander";
import type { MigrationRun } from "@storyblok/schema";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { migrationsCommand } from "../command";
import {
  contentJournal,
  discoverContentMigrations,
  migrationsDirectory,
  pendingMigrations,
  plural,
  toMigrationCommandError,
  warnAboutMisnamedMigrations,
} from "../content-migrations";
import { listRollbackFiles } from "../rollback/actions";

const listCmd = migrationsCommand
  .command("list")
  .description(
    "List the migration runs recorded for a space on this machine, then the content migrations without one",
  )
  .option("-s, --space <space>", "space ID")
  .option("--pending", "List only the migrations without a recorded run that is still in place");

function rollbackState(run: MigrationRun): string {
  if (run.undoneAt) return `  (rolled back ${run.undoneAt})`;
  if (run.partlyUndoneAt) return `  (partly rolled back ${run.partlyUndoneAt})`;
  if (run.interrupted) return "  (interrupted)";
  // `rollback` without a run passes over such a run, so it never shows as rolled back.
  if (run.stories === 0) return "  (nothing to roll back)";
  return "";
}

listCmd.action(async (options: { pending?: boolean }, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const { space, path, verbose } = command.optsWithGlobals();

  // `--pending` output is read by scripts, so it carries the ids and nothing else.
  if (!options.pending) {
    ui.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, "Listing migration runs...");
  }

  if (!space) {
    handleError(
      new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`),
      verbose,
    );
    return;
  }

  logger.info("Migration list started", { space });

  try {
    await warnAboutMisnamedMigrations(migrationsDirectory(path, space));

    const runs = await contentJournal(path).list(space);
    const files = await discoverContentMigrations(migrationsDirectory(path, space));
    const pending = pendingMigrations(
      files.map((file) => file.id),
      runs,
    );

    if (options.pending) {
      for (const id of pending) {
        ui.writeMachineOutput(id);
      }
      return;
    }
    const rollbackFiles = await listRollbackFiles({ space, path });
    const entries = [
      ...runs.map((run) => ({
        at: new Date(run.appliedAt).getTime(),
        // The run id ends with the migration id, so only a title adds to it.
        line: `${run.id}${run.title ? `  ${run.title}` : ""}  ${plural(run.stories, "story", "stories")}, ${plural(run.blocks, "block", "blocks")}${rollbackState(run)}`,
      })),
      ...rollbackFiles.map((file) => ({
        at: file.createdAt.getTime(),
        line: `${file.name}  migration functions  ${plural(file.stories, "story", "stories")}  (rollback file)`,
      })),
    ].sort((a, b) => a.at - b.at);

    if (entries.length === 0) {
      ui.info("No migration runs recorded for this space.");
    }
    for (const entry of entries) {
      ui.info(entry.line);
    }
    if (pending.length > 0) {
      ui.info(`Pending on this machine: ${pending.join(", ")}`);
    }
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Migration list finished", { space });
});
