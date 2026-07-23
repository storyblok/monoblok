import { removePatCredentials } from '../../creds';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import { handleError, konsola } from '../../utils';
import { session } from '../../session';
import { resolveOAuthClient } from '../oauth/client';
import { getOAuthEntry } from '../oauth/store';
import { revokeToken } from '../oauth/token-endpoint';

const program = getProgram(); // Get the shared singleton instance

export const logoutCommand = program
  .command(commands.LOGOUT)
  .description('Logout from the Storyblok CLI')
  .action(async () => {
    konsola.title(`${commands.LOGOUT}`, colorPalette.LOGOUT);

    const verbose = program.opts().verbose;
    try {
      const { state, initializeSession, clearOAuthSession } = session();
      await initializeSession();

      if (!state.isLoggedIn) {
        konsola.warn(`You are already logged out. If you want to login, please use the login command.`);
        konsola.br();
        return;
      }

      if (state.authType === 'oauth' && state.region) {
        // Revoke the grant server-side (best-effort) before clearing the local session,
        // so the tokens can no longer mint new tokens after logout. A network/API failure
        // must not block the local logout.
        const { tokens } = await getOAuthEntry(state.region);
        const tokenToRevoke = tokens?.refresh_token ?? tokens?.access_token;
        if (tokenToRevoke) {
          try {
            const client = await resolveOAuthClient(state.region);
            await revokeToken(state.region, tokenToRevoke, client);
          }
          catch (error) {
            konsola.warn(`Could not revoke the OAuth session server-side: ${(error as Error).message}`);
          }
        }
        await clearOAuthSession(state.region);
      }
      else {
        await removePatCredentials();
      }

      konsola.ok(`Successfully logged out.`, true);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
    konsola.br();
  });
