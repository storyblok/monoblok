import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const logsCommand = program
  .command(commands.LOGS)
  .alias('lg')
  .description(`Inspect and manage logs.`)
  .option('-s, --space <space>', 'The space ID.')
  .option('-p, --path <path>', 'Path to the directory containing the logs directory. Defaults to \'.storyblok\'.');
