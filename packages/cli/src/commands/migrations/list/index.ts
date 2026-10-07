import type { Command } from "commander";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { migrationsCommand } from "../command";
import { contentJournal, plural, toMigrationCommandError } from "../content-migrations";

const listCmd = migrationsCommand
  .command("list")
  .description("List the content migration runs recorded for a space")
  .option("-s, --space <space>", "space ID");

listCmd.action(async (_options: unknown, command: Command) => {
  const ui = getUI();
  const logger = getLogger();
  const { space, path, verbose } = command.optsWithGlobals();
  const { state } = session();

  ui.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, "Listing content migration runs...");

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

  logger.info("Content migration list started", { space });

  try {
    const runs = await contentJournal(path).list(space);

    if (runs.length === 0) {
      ui.info("No content migration runs recorded for this space.");
    }
    for (const run of runs) {
      ui.info(
        `${run.id}  ${run.title ?? run.migration}  ${plural(run.stories, "story", "stories")}, ${plural(run.blocks, "block", "blocks")}`,
      );
    }
  } catch (maybeError) {
    handleError(toMigrationCommandError(maybeError), verbose);
  }

  logger.info("Content migration list finished", { space });
});
