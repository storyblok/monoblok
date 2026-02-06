import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const reportsCommand = program
  .command(commands.REPORTS)
  .alias('rp')
  .description('Inspect and manage reports.');
