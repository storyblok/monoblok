import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const oauthCommand = program
  .command(commands.OAUTH)
  .description('POC: OAuth Authorization Code Grant flow (DX-484)');
