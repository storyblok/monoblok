import { Command } from "commander";
import { join } from "pathe";
import { CommandError, getPackageJson, handleError } from "./utils";
import { directories } from "./constants";

import type { LogLevel, LogTransport } from "./lib/logger/logger";
import { getLogger, setLoggerTransports } from "./lib/logger/logger";
import { getUI } from "./lib/ui";
import { getReporter } from "./lib/reporter/reporter";
import { FileTransport } from "./lib/logger/logger-transport-file";
import { ConsoleTransport } from "./lib/logger/logger-transport-console";
import { resolveCommandPath } from "./utils/filesystem";
import { session } from "./session";
import { getMapiClient } from "./api";
import { assertOAuthRegionAuthorized, isSessionCommand } from "./lib/oauth/region-guard";
import { assertSpaceAllowed } from "./lib/oauth/space-guard";
import { createOAuthTokenProvider } from "./lib/oauth/token-provider";
import { setCredentialContext } from "./utils/error/credential-context";
import {
  applyConfigToCommander,
  getCommandAncestry,
  GLOBAL_OPTION_DEFINITIONS,
  resolveConfig,
  setActiveConfig,
} from "./lib/config";

const packageJson = getPackageJson();

/** The top-level command name (`stories` for `storyblok stories pull`). */
function getRootCommandName(command: Command): string {
  let current = command;
  while (current.parent?.parent) {
    current = current.parent as Command;
  }
  return current.name();
}

// Declare a variable to hold the singleton instance
let programInstance: Command | null = null;

/**
 * Get the shared program singleton instance
 *
 * @export getProgram
 * @return {*}  {Command}
 */
export function getProgram(): Command {
  if (!programInstance) {
    programInstance = new Command();

    // Basic program setup
    programInstance
      .name(packageJson.name)
      .description(packageJson.description || "")
      .version(packageJson.version, "-v, --vers", "Output the current version")
      .helpOption("-h, --help", "Display help for command");

    // Register all global config options
    for (const option of GLOBAL_OPTION_DEFINITIONS) {
      if (option.parser) {
        programInstance.option(
          option.flags,
          option.description,
          option.parser as (value: string, previous: unknown) => unknown,
          option.defaultValue as string | boolean | number,
        );
      } else {
        programInstance.option(
          option.flags,
          option.description,
          option.defaultValue as string | boolean | string[],
        );
      }
    }

    // Unified preAction hook: handles config resolution, then logging/reporting setup
    programInstance.hook("preAction", async (thisCommand, actionCommand) => {
      const targetCommand = actionCommand ?? thisCommand;

      // Step 1: Resolve and apply configuration
      const ancestry = getCommandAncestry(targetCommand);
      const resolvedConfig = await resolveConfig(targetCommand, ancestry);
      applyConfigToCommander(ancestry, resolvedConfig);
      setActiveConfig(resolvedConfig);

      // Initialize mapiClient with the active credential (PAT or OAuth access token).
      const { state, initializeSession, useOAuthRegion } = session();
      await initializeSession();

      // Reconcile an explicit region with the OAuth session before any token work, so a
      // refresh and the mapi client both target the region the command will actually use.
      // A thrown CommandError here propagates out of the preAction hook, rejecting
      // `program.parseAsync()` in index.ts, which handles it once at the top level.
      if (state.authType === "oauth" && !isSessionCommand(getRootCommandName(targetCommand))) {
        await assertOAuthRegionAuthorized(resolvedConfig.region, state.region, useOAuthRegion);
      }

      if (state.authType === "oauth" && state.region) {
        // A provider rather than a token string: access tokens live 15 minutes, so a
        // command that runs longer refreshes mid-run instead of 401ing. Commands that
        // need no auth never call it, so they never pay for a refresh.
        state.oauthTokenProvider = createOAuthTokenProvider(state.region, state);
        getMapiClient({
          oauthToken: state.oauthTokenProvider,
          region: state.region ?? resolvedConfig.region,
        });
      } else if (state.password) {
        getMapiClient({
          personalAccessToken: state.password,
          region: state.region ?? resolvedConfig.region,
        });
      }

      // Tell the error layer which credential is in play so 401/403 responses can name
      // the right remedy. Set for every credential kind, including none at all.
      setCredentialContext({
        kind: state.authType ?? "unknown",
        spaces: state.oauthSpaces,
        space: targetCommand.optsWithGlobals().space,
      });

      // Guard OAuth sessions against operating on spaces outside their consent grant.
      // A thrown CommandError here propagates out of the preAction hook, rejecting
      // `program.parseAsync()` in index.ts, which handles it once at the top level.
      if (state.authType === "oauth") {
        assertSpaceAllowed(targetCommand.optsWithGlobals().space, state.oauthSpaces);
      }

      // Step 2: Setup logging, UI, and reporting with resolved config
      const options = targetCommand.optsWithGlobals();
      const commandPieces: string[] = [];
      for (let c: Command | null = targetCommand; c; c = c.parent as Command | null) {
        commandPieces.unshift(c.name());
      }
      const command = commandPieces.join(" ");

      const runId = Date.now();

      // Initialize logger with transports based on config
      let logFilePath: string | undefined;

      const transports: LogTransport[] = [];

      // Add console transport if enabled
      if (resolvedConfig.log.console.enabled) {
        transports.push(
          new ConsoleTransport({
            level: resolvedConfig.log.console.level as LogLevel,
          }),
        );
      }

      // Add file transport if enabled
      if (resolvedConfig.log.file.enabled) {
        const logsPath = resolveCommandPath(directories.logs, options.space, options.path);
        const logFilename = `${commandPieces.join("-")}-${runId}.jsonl`;
        logFilePath = join(logsPath, logFilename);
        transports.push(
          new FileTransport({
            filePath: logFilePath,
            level: resolvedConfig.log.file.level as LogLevel,
            maxFiles: resolvedConfig.log.file.maxFiles,
          }),
        );
      }

      // Initialize logger with configured transports
      const logger = getLogger({
        context: { runId, command, options, cliVersion: packageJson.version },
        transports,
      });

      // If logger already existed (created before preAction), update its transports
      if (logger.transports.length === 0 && transports.length > 0) {
        setLoggerTransports(transports);
      }

      // Initialize UI with resolved config
      getUI({ enabled: resolvedConfig.ui.enabled });

      // Initialize reporter based on config
      if (resolvedConfig.report.enabled) {
        const reportPath = resolveCommandPath(directories.reports, options.space, options.path);
        const reportFilename = `${commandPieces.join("-")}-${runId}.json`;
        const reportFilePath = join(reportPath, reportFilename);
        const reporter = getReporter({
          enabled: true,
          filePath: reportFilePath,
          maxFiles: resolvedConfig.report.maxFiles,
        });

        // Add metadata to reporter
        reporter
          .addMeta("command", command)
          .addMeta("cliVersion", packageJson.version)
          .addMeta("runId", String(runId))
          .addMeta("config", options);

        // Add logPath if file logging is enabled
        if (logFilePath) {
          reporter.addMeta("logPath", logFilePath);
        }
      }
    });

    // Prevent Commander from calling process.exit() so our exitCode convention is respected
    programInstance.exitOverride();

    // Intercept Commander's error output so usage errors become CommandError (exit code 2)
    programInstance.configureOutput({
      writeErr: (str) => handleError(new CommandError(str.replace(/^error:\s*/i, "").trim())),
    });
  }

  return programInstance;
}
