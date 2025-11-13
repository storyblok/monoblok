import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

// Assets root command
export const assetsCommand = program
  .command(commands.ASSETS)
  .alias('as')
  .description(`Manage your space's assets`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/assets');
