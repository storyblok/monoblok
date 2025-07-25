import { resolveRegion } from '../../utils/region';
import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

// Components root command
export const migrationsCommand = program
  .command(commands.MIGRATIONS)
  .alias('mig')
  .description(`Manage your space's migrations`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/migrations')
  .hook('preAction', resolveRegion);
