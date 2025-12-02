import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const reportsCommand = program
  .command(commands.REPORTS)
  .alias('rp')
  .description('Inspect and manage reports.')
  .option('-s, --space <space>', 'The space ID.')
  .option('-p, --path <path>', 'Path to the directory containing the reports directory. Defaults to \'.storyblok\'.');
