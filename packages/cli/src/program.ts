import { Command } from 'commander';
import type { NormalizedPackageJson } from 'read-package-up';
import { readPackageUp } from 'read-package-up';
import { __dirname, handleError } from './utils';
import type { LogTransport } from './utils/logger';
import { ConsoleTransport } from './utils/logger-transport-console';
import { getLogger } from './utils/logger';
import { getUI } from './utils/ui';

let packageJson: NormalizedPackageJson;
// Read package.json for metadata
const result = await readPackageUp({
  cwd: __dirname,
});

if (!result) {
  console.debug('Metadata not found');
  packageJson = {
    name: 'storyblok',
    description: 'Storyblok CLI',
    version: '0.0.0',
  } as NormalizedPackageJson;
}
else {
  packageJson = result.packageJson;
}

// Declare a variable to hold the singleton instance
let programInstance: Command | null = null;

// Singleton function to get the instance of program
/**
 * Get the shared program singleton instance
 *
 * @export getProgram
 * @return {*}  {Command}
 */
export function getProgram(): Command {
  if (!programInstance) {
    programInstance = new Command();
    programInstance
      .name(packageJson.name)
      .description(packageJson.description || '')
      .version(packageJson.version)
      .hook('preAction', (_, actionCmd) => {
        const options = actionCmd.optsWithGlobals();
        const path: string[] = [];
        for (let c: Command | null = actionCmd; c; c = c.parent as Command | null) {
          path.unshift(c.name());
        }
        const command = path.join(' ');

        const transports: LogTransport[] = [];
        if (options.logConsole) {
          transports.push(new ConsoleTransport({ level: options.logConsoleLevel }));
        }
        getLogger({
          context: { runId: Date.now(), command, options, cliVersion: packageJson.version },
          transports,
        });

        getUI({ enabled: options.ui });
      });

    // Global error handling
    programInstance.configureOutput({
      writeErr: str => handleError(new Error(str)),
    });
  }
  return programInstance;
}
