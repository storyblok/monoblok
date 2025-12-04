import { Command } from 'commander';
import path from 'node:path';
import { getPackageJson, handleError } from './utils';

import type { LogLevel, LogTransport } from './lib/logger/logger';
import { getLogger, setLoggerTransports } from './lib/logger/logger';
import { getUI } from './utils/ui';
import { getReporter } from './lib/reporter/reporter';
import { FileTransport } from './lib/logger/logger-transport-file';
import { ConsoleTransport } from './lib/logger/logger-transport-console';
import { resolveCommandPath } from './utils/filesystem';
import { directories } from './constants';
import {
  applyConfigToCommander,
  getCommandAncestry,
  GLOBAL_OPTION_DEFINITIONS,
  logActiveConfig,
  resolveConfig,
  setActiveConfig,
} from './lib/config';

const packageJson = getPackageJson();

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
      .description(packageJson.description || '')
      .version(packageJson.version, '-v, --vers', 'Output the current version')
      .helpOption('-h, --help', 'Display help for command');

    // Register all global config options
    for (const option of GLOBAL_OPTION_DEFINITIONS) {
      if (option.parser) {
        programInstance.option(
          option.flags,
          option.description,
          option.parser as (value: string, previous: unknown) => unknown,
          option.defaultValue as string | boolean | number,
        );
      }
      else {
        programInstance.option(
          option.flags,
          option.description,
          option.defaultValue as string | boolean | string[],
        );
      }
    }

    // Unified preAction hook: handles config resolution, then logging/reporting setup
    programInstance.hook('preAction', async (thisCommand, actionCommand) => {
      const targetCommand = actionCommand ?? thisCommand;

      // Step 1: Resolve and apply configuration
      const ancestry = getCommandAncestry(targetCommand);
      const resolvedConfig = await resolveConfig(targetCommand, ancestry);
      applyConfigToCommander(ancestry, resolvedConfig);
      setActiveConfig(resolvedConfig);
      logActiveConfig(resolvedConfig, ancestry, resolvedConfig.verbose);

      // Step 2: Setup logging, UI, and reporting with resolved config
      const options = targetCommand.optsWithGlobals();
      const commandPieces: string[] = [];
      for (
        let c: Command | null = targetCommand;
        c;
        c = c.parent as Command | null
      ) {
        commandPieces.unshift(c.name());
      }
      const command = commandPieces.join(' ');

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
        const logsPath = resolveCommandPath(
          directories.log,
          options.space,
          options.path,
        );
        const logFilename = `${commandPieces.join('-')}-${runId}.jsonl`;
        logFilePath = path.join(logsPath, logFilename);
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

      // Initialize UI
      getUI({ enabled: resolvedConfig.ui.enabled });

      // Initialize reporter based on config
      if (resolvedConfig.report.enabled) {
        const reportPath = resolveCommandPath(
          directories.report,
          options.space,
          options.path,
        );
        const reportFilename = `${commandPieces.join('-')}-${runId}.json`;
        const reportFilePath = path.join(reportPath, reportFilename);
        const reporter = getReporter({
          enabled: true,
          filePath: reportFilePath,
          maxFiles: resolvedConfig.report.maxFiles,
        });

        // Add metadata to reporter
        reporter
          .addMeta('command', command)
          .addMeta('cliVersion', packageJson.version)
          .addMeta('runId', String(runId))
          .addMeta('config', options);

        // Add logPath if file logging is enabled
        if (logFilePath) {
          reporter.addMeta('logPath', logFilePath);
        }
      }
    });

    // Global error handling
    programInstance.configureOutput({
      writeErr: str => handleError(new Error(str)),
    });
  }

  return programInstance;
}
