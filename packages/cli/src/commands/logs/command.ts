import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const logsCommand = program
  .command(commands.LOGS)
  .alias('lg')
  .description(`Inspect and manage logs.`);
