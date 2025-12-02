import { Command } from 'commander';
import path from 'node:path';
import { getPackageJson, handleError } from './utils';

import type { LogTransport } from './lib/logger/logger';
import { getLogger } from './lib/logger/logger';
import { getUI } from './utils/ui';
import { getReporter } from './lib/reporter/reporter';
import { FileTransport } from './lib/logger/logger-transport-file';
import { resolveCommandPath } from './utils/filesystem';
import { directories } from './constants';
import { applyConfigToCommander, getCommandAncestry, GLOBAL_OPTION_DEFINITIONS, logActiveConfig, resolveConfig, setActiveConfig } from './lib/config';

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
      .helpOption('-h, --help', 'Display help for command')
      .option('--verbose', 'Enable verbose output');

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
      const resolved = await resolveConfig(targetCommand, ancestry);
      applyConfigToCommander(ancestry, resolved);
      setActiveConfig(resolved);
      logActiveConfig(resolved, ancestry, resolved.verbose);

      // Step 2: Setup logging, UI, and reporting with resolved config
      const options = targetCommand.optsWithGlobals();
      const commandPieces: string[] = [];
      for (let c: Command | null = targetCommand; c; c = c.parent as Command | null) {
        commandPieces.unshift(c.name());
      }
      const command = commandPieces.join(' ');

      const runId = Date.now();

      // Initialize logger with file transport
      const transports: LogTransport[] = [];
      const logsPath = resolveCommandPath(directories.log, options.space, options.path);
      const logFilename = `${commandPieces.join('-')}-${runId}.jsonl`;
      const filePath = path.join(logsPath, logFilename);
      transports.push(new FileTransport({
        filePath,
        maxFiles: 10,
      }));
      getLogger({
        context: { runId, command, options, cliVersion: packageJson.version },
        transports,
      });

      // Initialize UI
      getUI({ enabled: true });

      // Initialize reporter
      const reportPath = resolveCommandPath(directories.report, options.space, options.path);
      const reportFilename = `${commandPieces.join('-')}-${runId}.jsonl`;
      const reportFilePath = path.join(reportPath, reportFilename);
      getReporter({ enabled: true, filePath: reportFilePath })
        .addMeta('command', command)
        .addMeta('cliVersion', packageJson.version)
        .addMeta('runId', String(runId))
        .addMeta('logPath', filePath)
        .addMeta('config', options);
    });

    // Global error handling
    programInstance.configureOutput({
      writeErr: str => handleError(new Error(str)),
    });
  }

  return programInstance;
}
