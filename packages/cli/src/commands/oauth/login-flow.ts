import open from 'open';
import type { RegionCode } from '../../constants';
import { managementApiRegions } from '../../constants';
import { CommandError } from '../../utils';
import { getUI } from '../../utils/ui';
import { resolveOAuthClient } from './client';
import { DEFAULT_LOGIN_SCOPES, OAUTH_CALLBACK_PATH, OAUTH_CALLBACK_PORT, OAUTH_REDIRECT_URI } from './constants';
import { introspectGrant } from './grant';
import { generatePkce, generateState } from './pkce';
import { computeExpiresAt } from './refresh';
import { waitForCallback } from './server';
import { getOAuthEntry, setOAuthActiveRegion, updateOAuthEntry } from './store';
import type { OAuthGrantSpace, OAuthTokens } from './store';
import { exchangeToken } from './token-endpoint';

export interface OAuthLoginResult {
  region: RegionCode;
  scopes: string[];
  spaces: OAuthGrantSpace[];
}

export const buildAuthorizeUrl = (params: {
  region: RegionCode;
  clientId: string;
  scopes: string[];
  state: string;
  challenge: string;
}): string => {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: params.scopes.join(' '),
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
  });
  return `https://${managementApiRegions[params.region]}/oauth/init?${query.toString()}`;
};

export const performOAuthLogin = async (options: {
  region: RegionCode;
  openBrowser?: (url: string) => Promise<unknown>;
}): Promise<OAuthLoginResult> => {
  const { region } = options;
  const openBrowser = options.openBrowser ?? (url => open(url));
  const ui = getUI();

  const client = await resolveOAuthClient(region);
  const resolvedScopes = (await getOAuthEntry(region)).client?.scopes ?? client.scopes;
  const scopes = resolvedScopes ?? DEFAULT_LOGIN_SCOPES;
  if (!resolvedScopes) {
    // Bring-your-own clients (env vars or a manually stored id/secret) have no
    // scope catalog, so we request a restrictive default set. If the client was
    // granted broader scopes, provision it via `oauth setup` to request them.
    ui.warn(
      `No scopes stored for this OAuth client; requesting the default set: ${DEFAULT_LOGIN_SCOPES.join(', ')}.\n`
      + `Run \`storyblok oauth setup --token <personal-access-token>\` to provision a client with the full scope catalog.`,
    );
  }
  const { verifier, challenge } = generatePkce();
  const state = generateState();

  // Start listening before opening the browser so no callback is missed.
  const callbackPromise = waitForCallback(OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH);

  const authorizeUrl = buildAuthorizeUrl({ region, clientId: client.client_id, scopes, state, challenge });
  ui.info(`Opening your browser to authorize the Storyblok CLI.\nIf it does not open, visit:\n${authorizeUrl}`);
  await openBrowser(authorizeUrl);

  const { code, state: returnedState } = await callbackPromise;
  if (returnedState !== state) {
    throw new CommandError('OAuth state mismatch; aborting for your safety. Please try `storyblok login` again.');
  }

  const token = await exchangeToken(region, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
    code_verifier: verifier,
    client_id: client.client_id,
    client_secret: client.client_secret,
  });

  // Introspect the grant before persisting anything: a failed introspection must not leave
  // tokens on disk without a `spaces` list, which the space guard would treat as unrestricted.
  const grant = await introspectGrant(region, token.access_token);

  const tokens: OAuthTokens = {
    auth_type: 'oauth',
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: computeExpiresAt(token.expires_in),
  };
  await updateOAuthEntry(region, { tokens, spaces: grant.spaces });
  // Mark this region as active so the next session resolves here rather than by
  // fixed region order when several regions are authenticated.
  await setOAuthActiveRegion(region);

  return { region, scopes: grant.scopes, spaces: grant.spaces };
};
