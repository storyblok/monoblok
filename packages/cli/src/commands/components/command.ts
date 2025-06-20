import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

// Components root command
export const componentsCommand = program
  .command('components')
  .alias('comp')
  .description(`Manage your space's block schema`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/components');
