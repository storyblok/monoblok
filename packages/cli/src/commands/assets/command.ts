import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const assetsCommand = program
  .command(commands.ASSETS)
  .description(`Manage your space's assets`)
  .option('-s, --space <space>', 'space ID');
