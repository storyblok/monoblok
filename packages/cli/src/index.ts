#!/usr/bin/env node
import "dotenv/config";

import { CommanderError } from "commander";
import { handleError } from "./utils";
import { getProgram } from "./program";
import { getUI } from "./lib/ui";
import { colorPalette } from "./constants";
import "./commands/login";
import "./commands/logout";
import "./commands/oauth";
import "./commands/signup";
import "./commands/user";
import "./commands/components";
import "./commands/languages";
import "./commands/migrations";
import "./commands/types";
import "./commands/datasources";
import "./commands/create";
import "./commands/logs";
import "./commands/reports";
import "./commands/assets";
import "./commands/stories";
import "./commands/schema";

export * from "./types/storyblok";

const program = getProgram();
const ui = getUI();

ui.br();
ui.title("Storyblok CLI", colorPalette.PRIMARY);
ui.br();

// Handle invalid commands
program.on("command:*", () => {
  console.error(`Invalid command: ${program.args.join(" ")}`);
  console.error("");
  // Write help text directly to stderr — do not use outputHelp({ error: true })
  // which routes through configureOutput.writeErr → handleError, turning help text into an error.
  console.error(program.helpInformation());
  process.exitCode = 2;
});

try {
  await program.parseAsync(process.argv);
} catch (error) {
  // Commander throws CommanderError after exitOverride — exit code is already set
  // via writeErr → handleError, so we only need to handle the --help / --version cases.
  if (error instanceof CommanderError) {
    // --help and --version throw with exitCode 0; let them pass silently
    if (error.exitCode !== 0) {
      // For parse errors, exitCode was already set by writeErr → handleError;
      // ensure it stays non-zero.
      if (!process.exitCode) {
        process.exitCode = error.exitCode;
      }
    }
  } else {
    handleError(error as Error);
  }
}
