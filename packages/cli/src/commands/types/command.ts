import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

export interface TypesCommandOptions {
  space: string;
  path?: string;
}

// Components root command
export const typesCommand = program
  .command(commands.TYPES)
  .alias('ts')
  .description(`Generate types d.ts for your component schemas`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/types');
