import type { Command } from "commander";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication, toError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { migrationsCommand } from "../command";
import { resolveJournal } from "../content-journal";
import { formatRuns } from "./actions";

const listCmd = migrationsCommand
  .command("list")
  .description("List content migrations recorded for a space")
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
    const journal = resolveJournal({ path });
    const runs = await journal.list(space);

    if (runs.length === 0) {
      ui.info("No migration runs recorded for this space.");
    } else {
      for (const line of formatRuns(runs)) {
        ui.info(line);
      }
    }
  } catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }

  logger.info("Content migration list finished", { space });
});
