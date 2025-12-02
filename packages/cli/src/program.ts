// program.ts
import { Command } from 'commander';
import { getPackageJson, handleError } from './utils';
import { loadConfig } from './lib/config/loader';

const packageJson = getPackageJson();

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
      .version(packageJson.version);

    // Global error handling
    programInstance.configureOutput({
      writeErr: str => handleError(new Error(str)),
    });
  }
  return programInstance;
}

export async function getConfigDefaults(): Promise<Record<string, any>> {
  const { config } = await loadConfig({
    name: 'storyblok',
    defaults: {},
  });
  return config || {};
}
