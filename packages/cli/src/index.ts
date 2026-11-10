#!/usr/bin/env node
import "dotenv/config";

import { CommanderError } from "commander";
import { CommandError, handleError } from "./utils";
import { getProgram } from "./program";
import { getUI, isPagerOpen } from "./lib/ui";
import { colorPalette } from "./constants";
import {
  recordTelemetryError,
  recordTelemetryInterrupt,
  sendTelemetry,
  TELEMETRY_INTERRUPT_TIMEOUT_MS,
} from "./lib/telemetry";
import "./commands/login";
import "./commands/logout";
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
import "./commands/telemetry";

export * from "./types/storyblok";

const EXIT_CODE_INTERRUPTED = 130;

const startTime = performance.timeOrigin;
const program = getProgram();
const ui = getUI();

// Without a listener, Ctrl+C kills the process before the run can be recorded.
let interrupted = false;
process.on("SIGINT", async () => {
  if (isPagerOpen()) {
    return;
  }
  if (interrupted) {
    process.exit(EXIT_CODE_INTERRUPTED);
  }
  interrupted = true;
  recordTelemetryInterrupt();
  await sendTelemetry(
    { program, startTime, exitCode: EXIT_CODE_INTERRUPTED },
    TELEMETRY_INTERRUPT_TIMEOUT_MS,
  );
  process.exit(EXIT_CODE_INTERRUPTED);
});

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
  recordTelemetryError(new CommandError("Invalid command"));
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

await sendTelemetry({ program, startTime, exitCode: Number(process.exitCode ?? 0) });
