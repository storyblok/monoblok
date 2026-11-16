import chalk from "chalk";
import { colorPalette, commands } from "../../constants";
import { getProgram } from "../../program";
import { handleError, toError } from "../../utils";
import { getUI } from "../../lib/ui";
import { PRIVACY_POLICY_URL, TELEMETRY_DOCS_URL, TELEMETRY_ENV } from "../../lib/telemetry/config";
import { getConsentFilePath, getTelemetryStatus, saveConsent } from "../../lib/telemetry/consent";
import type { TelemetryStatus } from "../../lib/telemetry/consent";
import {
  canPromptForTelemetryConsent,
  isTelemetryDebugEnabled,
} from "../../lib/telemetry/telemetry";

const program = getProgram();

const ENABLE_COMMAND = chalk.hex(colorPalette.PRIMARY)(`storyblok ${commands.TELEMETRY} enable`);

function getDisabledMessage(status: Extract<TelemetryStatus, { enabled: false }>): string {
  switch (status.reason) {
    case "environment":
      return `Telemetry is disabled because ${status.variable} is set.`;
    case "declined":
      return `Telemetry is disabled: you declined. Run ${ENABLE_COMMAND} to enable it.`;
    case "undecided":
      return canPromptForTelemetryConsent()
        ? `Telemetry is disabled. The CLI asks on the next run, or run ${ENABLE_COMMAND}.`
        : `Telemetry is disabled. The CLI doesn't ask in this environment; run ${ENABLE_COMMAND} to enable it.`;
  }
}

export const telemetryCommand = program
  .command(commands.TELEMETRY)
  .description("Show or change the telemetry setting")
  .addHelpText(
    "after",
    [
      "",
      `${TELEMETRY_ENV.DISABLED}=1 or ${TELEMETRY_ENV.DO_NOT_TRACK}=1 turns telemetry off, even when enabled.`,
      `${TELEMETRY_ENV.DEBUG}=1 prints the data to stderr instead of sending it, also when telemetry is disabled.`,
      `Details: ${TELEMETRY_DOCS_URL}`,
    ].join("\n"),
  );

telemetryCommand
  .command("status", { isDefault: true })
  .description("Show whether telemetry is enabled")
  .action(() => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);

    const status = getTelemetryStatus();
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
    ui.info(`Privacy policy: ${PRIVACY_POLICY_URL}`);
  });

telemetryCommand
  .command("enable")
  .description("Enable telemetry")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.TELEMETRY}`, colorPalette.TELEMETRY);
    try {
      await saveConsent(true);
      const status = getTelemetryStatus();
      if (status.enabled) {
        ui.ok("Telemetry is enabled.");
        ui.info(`Install ID: ${status.installId}`);
      } else if (status.reason === "environment") {
        ui.warn(
          `Telemetry is enabled, but ${status.variable} is set, so the CLI sends nothing until you unset it.`,
        );
      }
      ui.info(`Stored in: ${getConsentFilePath()}`);
      ui.info(`What is shared: ${TELEMETRY_DOCS_URL}`);
      ui.info(`Privacy policy: ${PRIVACY_POLICY_URL}`);
    } catch (error) {
      handleError(toError(error), program.opts().verbose);
    }
  });

telemetryCommand
  .command("disable")
  .description("Disable telemetry")
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
