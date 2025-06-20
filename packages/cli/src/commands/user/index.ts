import chalk from 'chalk';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import { handleError, isVitest, konsola, requireAuthentication } from '../../utils';
import { getUser } from './actions';
import { session } from '../../session';
import { Spinner } from '@topcli/spinner';

const program = getProgram(); // Get the shared singleton instance

export const userCommand = program
  .command(commands.USER)
  .description('Get the current user')
  .action(async () => {
    konsola.title(` ${commands.USER} `, colorPalette.USER);
    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state)) {
      return;
    }
    const spinner = new Spinner({
      verbose: !isVitest,
    }).start(`Fetching user info`);
    try {
      const { password, region } = state;
      if (!password || !region) {
        throw new Error('No password or region found');
      }
      const { user } = await getUser(password, region);
      spinner.succeed();
      konsola.ok(`Hi ${chalk.bold(user.friendly_name)}, you are currently logged in with ${chalk.hex(colorPalette.PRIMARY)(user.email)} on ${chalk.bold(region)} region`, true);
    }
    catch (error) {
      spinner.failed();
      handleError(error as Error, true);
    }
    konsola.br();
  });
