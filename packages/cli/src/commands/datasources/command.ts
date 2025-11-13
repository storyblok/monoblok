import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

// Components root command
export const datasourcesCommand = program
  .command(commands.DATASOURCES)
  .alias('ds')
  .description(`Manage your space's datasources`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/datasources');
