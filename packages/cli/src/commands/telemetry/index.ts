import chalk from "chalk";
import { colorPalette, commands } from "../../constants";
import { getProgram } from "../../program";
import { handleError } from "../../utils";
import { getUI } from "../../lib/ui";
import {
  getTelemetryStatus,
  isTelemetryDebugEnabled,
  saveConsent,
  PRIVACY_NOTICE_URL,
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
      return "Telemetry is disabled.";
    case "undecided":
      return `Telemetry is disabled. Run ${ENABLE_COMMAND} to share usage data.`;
  }
}

export const telemetryCommand = program
  .command(commands.TELEMETRY)
  .description("Show or change whether the CLI shares usage data");

telemetryCommand
  .command("status")
  .description("Show whether usage data is shared")
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
        `Debug mode is on (${TELEMETRY_ENV.DEBUG}): payloads are printed to stderr, never sent.`,
      );
    }
    ui.info(`Privacy policy: ${PRIVACY_NOTICE_URL}`);
  });

telemetryCommand
  .command("enable")
  .description("Share usage data")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);
    try {
      await saveConsent(true);
      ui.ok("Telemetry is enabled. Thank you for helping improve the CLI.");
      const status = await getTelemetryStatus();
      if (!status.enabled && status.reason === "environment") {
        ui.warn(`${status.variable} is set and takes precedence: nothing is sent.`);
      }
    } catch (error) {
      handleError(error as Error, program.opts().verbose);
    }
  });

telemetryCommand
  .command("disable")
  .description("Stop sharing usage data")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);
    try {
      await saveConsent(false);
      ui.ok("Telemetry is disabled.");
    } catch (error) {
      handleError(error as Error, program.opts().verbose);
    }
  });
