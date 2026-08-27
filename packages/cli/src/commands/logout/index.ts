import { removePatCredentials } from "../../creds";
import { colorPalette, commands } from "../../constants";
import { getProgram } from "../../program";
import { handleError } from "../../utils";
import { session } from "../../session";
import { getUI } from "../../lib/ui";
import { resolveOAuthClient } from "../../lib/oauth/client";
import { getOAuthEntry } from "../../lib/oauth/store";
import { revokeToken } from "../../lib/oauth/token-endpoint";

const program = getProgram(); // Get the shared singleton instance

export const logoutCommand = program
  .command(commands.LOGOUT)
  .description("Logout from the Storyblok CLI")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.LOGOUT}`, colorPalette.LOGOUT);

    const verbose = program.opts().verbose;
    try {
      const { state, initializeSession, clearOAuthSession } = session();
      await initializeSession();

      if (!state.isLoggedIn) {
        ui.warn(`You are already logged out. If you want to login, please use the login command.`);
        ui.br();
        return;
      }

      if (state.authType === "oauth" && state.region) {
        // Revoke the grant server-side (best-effort) before clearing the local session,
        // so the tokens can no longer mint new tokens after logout. A network/API failure
        // must not block the local logout.
        const { tokens } = await getOAuthEntry(state.region);
        const tokenToRevoke = tokens?.refresh_token ?? tokens?.access_token;
        if (tokenToRevoke) {
          try {
            const client = resolveOAuthClient();
            await revokeToken(state.region, tokenToRevoke, client);
          } catch (error) {
            ui.warn(`Could not revoke the OAuth session server-side: ${(error as Error).message}`);
          }
        }
        await clearOAuthSession(state.region);
      } else {
        await removePatCredentials();
      }

      ui.ok(`Successfully logged out.`, true);
    } catch (error) {
      handleError(error as Error, verbose);
    }
    ui.br();
  });
