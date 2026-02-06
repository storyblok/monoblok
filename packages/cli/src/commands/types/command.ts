import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

// Components root command
export const typesCommand = program
  .command(commands.TYPES)
  .alias('ts')
  .description(`Generate types d.ts for your component schemas`);
