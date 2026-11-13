import chalk from "chalk";
import { colorPalette, commands } from "../../constants";
import { getProgram } from "../../program";
import { handleError, toError } from "../../utils";
import { getUI } from "../../lib/ui";
import {
  getTelemetryStatus,
  isTelemetryDebugEnabled,
  saveConsent,
  PRIVACY_NOTICE_URL,
  TELEMETRY_DOCS_URL,
  TELEMETRY_ENV,
} from "../../lib/telemetry";
import type { TelemetryStatus } from "../../lib/telemetry";

const program = getProgram();

const ENABLE_COMMAND = chalk.hex(colorPalette.PRIMARY)(`storyblok ${commands.TELEMETRY} enable`);

function getDisabledMessage(status: Extract<TelemetryStatus, { enabled: false }>): string {
  switch (status.reason) {
    case "environment":
      return `Telemetry is disabled because ${status.variable} is set.`;
    case "declined":
    case "undecided":
      return `Telemetry is disabled. Run ${ENABLE_COMMAND} to share usage data.`;
  }
}

export const telemetryCommand = program
  .command(commands.TELEMETRY)
  .description("Show or change whether the CLI shares usage data")
  .addHelpText(
    "after",
    [
      "",
      `${TELEMETRY_ENV.DISABLED}=1 or ${TELEMETRY_ENV.DO_NOT_TRACK}=1 turns telemetry off regardless of your answer.`,
      `${TELEMETRY_ENV.DEBUG}=1 prints the data to stderr instead of sending it.`,
      `Details: ${TELEMETRY_DOCS_URL}`,
    ].join("\n"),
  );

telemetryCommand
  .command("status")
  .description("Show whether the CLI shares usage data")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);

    const status = await getTelemetryStatus();
    if (status.enabled) {
      ui.ok("Telemetry is enabled.");
      ui.info(`Install ID: ${status.installId}`);
    } else {
      ui.info(getDisabledMessage(status));
    }
    if (isTelemetryDebugEnabled()) {
      ui.info(
        `${TELEMETRY_ENV.DEBUG} is set: the CLI prints the data to stderr instead of sending it.`,
      );
    }
    ui.info(`What is shared: ${TELEMETRY_DOCS_URL}`);
    ui.info(`Privacy policy: ${PRIVACY_NOTICE_URL}`);
  });

telemetryCommand
  .command("enable")
  .description("Turn telemetry on")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);
    try {
      await saveConsent(true);
      const status = await getTelemetryStatus();
      if (!status.enabled && status.reason === "environment") {
        ui.warn(
          `Your answer is saved, but ${status.variable} is set, so the CLI sends nothing until you unset it.`,
        );
      } else {
        ui.ok("Telemetry is enabled.");
      }
    } catch (error) {
      handleError(toError(error), program.opts().verbose);
    }
  });

telemetryCommand
  .command("disable")
  .description("Turn telemetry off")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);
    try {
      await saveConsent(false);
      ui.ok("Telemetry is disabled.");
    } catch (error) {
      handleError(toError(error), program.opts().verbose);
    }
  });
