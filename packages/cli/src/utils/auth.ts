import { colorPalette } from "../constants";
import type { SessionState } from "../session";
import { CommandError, handleError } from "./error";
import chalk from "chalk";

type AuthenticatedSessionState = SessionState & {
  isLoggedIn: true;
  password: NonNullable<SessionState["password"]>;
  region: NonNullable<SessionState["region"]>;
};

/** What a command says when nobody is logged in; `highlight` styles the commands. */
export function notLoggedInMessage(
  highlight: (command: string) => string = (command) => command,
): string {
  return `You are currently not logged in. Please run ${highlight("storyblok login")} to authenticate, or ${highlight("storyblok signup")} to sign up.`;
}

/**
 * Check if user is authenticated and handle error if not
 * @param state - Session state object
 * @param verbose - Whether to show verbose error output
 * @returns true if authenticated, false if not (and error is handled)
 */
export function requireAuthentication(
  state: SessionState,
  verbose = false,
): state is AuthenticatedSessionState {
  if (!state.isLoggedIn || !state.password || !state.region) {
    handleError(
      new CommandError(notLoggedInMessage((command) => chalk.hex(colorPalette.PRIMARY)(command))),
      verbose,
    );
    return false;
  }
  return true;
}
