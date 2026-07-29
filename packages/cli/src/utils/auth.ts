import { colorPalette } from '../constants';
import type { SessionState } from '../session';
import { CommandError, handleError } from './error';
import chalk from 'chalk';

type AuthenticatedSessionState = SessionState & {
  isLoggedIn: true;
  region: NonNullable<SessionState['region']>;
};

/**
 * A credential the management API client can authenticate with: a Personal Access
 * Token (PAT session) or an OAuth access token (OAuth session).
 */
export type ApiCredential = { personalAccessToken: string } | { oauthToken: string };

/**
 * Resolve the API credential for the current session, preferring an OAuth access
 * token when the session is OAuth-based and falling back to the PAT password.
 * @param state - Session state object
 * @returns the credential, or undefined when the session has neither
 */
export function sessionCredential(state: SessionState): ApiCredential | undefined {
  if (state.authType === 'oauth' && state.oauthAccessToken) {
    return { oauthToken: state.oauthAccessToken };
  }
  if (state.password) {
    return { personalAccessToken: state.password };
  }
  return undefined;
}

/**
 * Check if user is authenticated and handle error if not.
 * Accepts both PAT sessions (password) and OAuth sessions (access token).
 * @param state - Session state object
 * @param verbose - Whether to show verbose error output
 * @returns true if authenticated, false if not (and error is handled)
 */
export function requireAuthentication(state: SessionState, verbose = false): state is AuthenticatedSessionState {
  const hasCredential = Boolean(state.password) || (state.authType === 'oauth' && Boolean(state.oauthAccessToken));
  if (!state.isLoggedIn || !hasCredential || !state.region) {
    handleError(
      new CommandError(`You are currently not logged in. Please run ${chalk.hex(colorPalette.PRIMARY)('storyblok login')} to authenticate, or ${chalk.hex(colorPalette.PRIMARY)('storyblok signup')} to sign up.`),
      verbose,
    );
    return false;
  }
  return true;
}
