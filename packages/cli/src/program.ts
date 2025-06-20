// program.ts
import { Command } from 'commander';
import { __dirname, handleError } from './utils';
import type { NormalizedPackageJson } from 'read-package-up';
import { readPackageUp } from 'read-package-up';

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
      .version(packageJson.version);

    // Global error handling
    programInstance.configureOutput({
      writeErr: str => handleError(new Error(str)),
    });
  }
  return programInstance;
}
