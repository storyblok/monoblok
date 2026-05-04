import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const schemaCommand = program
  .command(commands.SCHEMA)
  .description(`Manage your space's schema from code`);
