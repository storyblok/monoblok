import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const storiesCommand = program
  .command(commands.STORIES)
  .description(`Manage your space's stories`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/stories');
