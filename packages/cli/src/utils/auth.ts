import { colorPalette } from '../constants';
import type { SessionState } from '../session';
import { CommandError, handleError } from './error';
import chalk from 'chalk';

type AuthenticatedSessionState = SessionState & {
  isLoggedIn: true;
  password: NonNullable<SessionState['password']>;
  region: NonNullable<SessionState['region']>;
};

/**
 * Check if user is authenticated and handle error if not
 * @param state - Session state object
 * @param verbose - Whether to show verbose error output
 * @returns true if authenticated, false if not (and error is handled)
 */
export function requireAuthentication(state: SessionState, verbose = false): state is AuthenticatedSessionState {
  if (!state.isLoggedIn || !state.password || !state.region) {
    handleError(
      new CommandError(`You are currently not logged in. Please run ${chalk.hex(colorPalette.PRIMARY)('storyblok login')} to authenticate, or ${chalk.hex(colorPalette.PRIMARY)('storyblok signup')} to sign up.`),
      verbose,
    );
    return false;
  }
  return true;
}
