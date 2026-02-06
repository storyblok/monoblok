import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const storiesCommand = program
  .command(commands.STORIES)
  .description(`Manage your space's stories`);
