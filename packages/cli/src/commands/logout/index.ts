import { removeAllCredentials } from '../../creds';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import { handleError, konsola } from '../../utils';
import { session } from '../../session';

const program = getProgram(); // Get the shared singleton instance

export const logoutCommand = program
  .command(commands.LOGOUT)
  .description('Logout from the Storyblok CLI')
  .action(async () => {
    konsola.title(` ${commands.LOGOUT} `, colorPalette.LOGOUT);

    const verbose = program.opts().verbose;
    try {
      const { state, initializeSession } = session();
      await initializeSession();
      if (!state.isLoggedIn || !state.password || !state.region) {
        konsola.warn(`You are already logged out. If you want to login, please use the login command.`);
        konsola.br();
        return;
      }
      await removeAllCredentials();

      konsola.ok(`Successfully logged out.`, true);
      konsola.br();
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
    konsola.br();
  });
