import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram(); // Get the shared singleton instance

// OAuth root command
export const oauthCommand = program
  .command(commands.OAUTH)
  .description('Manage OAuth client credentials for the CLI');
