import { removeAllCredentials } from "../../creds";
import { colorPalette, commands } from "../../constants";
import { getProgram } from "../../program";
import { handleError } from "../../utils";
import { session } from "../../session";
import { getUI } from "../../lib/ui";

const program = getProgram(); // Get the shared singleton instance

export const logoutCommand = program
  .command(commands.LOGOUT)
  .description("Logout from the Storyblok CLI")
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.LOGOUT}`, colorPalette.LOGOUT);

    const verbose = program.opts().verbose;
    try {
      const { state, initializeSession, clearOauthSession } = session();
      await initializeSession();

      if (!state.isLoggedIn) {
        ui.warn(`You are already logged out. If you want to login, please use the login command.`);
        ui.br();
        return;
      }

      if (state.authType === 'oauth' && state.region) {
        await clearOauthSession(state.region);
      }
      else {
        await removeAllCredentials();
      }

      ui.ok(`Successfully logged out.`, true);
      ui.br();
    } catch (error) {
      handleError(error as Error, verbose);
    }
    ui.br();
  });
