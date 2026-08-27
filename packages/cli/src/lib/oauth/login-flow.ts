import open from "open";
import type { RegionCode } from "../../constants";
import { managementApiRegions } from "../../constants";
import { getUI } from "../ui";
import { resolveOAuthClient } from "./client";
import {
  OAUTH_CALLBACK_PATH,
  OAUTH_CALLBACK_PORT,
  OAUTH_LOGIN_SCOPES,
  OAUTH_REDIRECT_URI,
} from "./constants";
import { introspectGrant } from "./grant";
import { generatePkce, generateState } from "./pkce";
import { computeExpiresAt } from "./refresh";
import { startCallbackServer } from "./server";
import { updateOAuthEntry } from "./store";
import type { OAuthGrantSpace, OAuthTokens } from "./store";
import { exchangeToken } from "./token-endpoint";

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
    response_type: "code",
    scope: params.scopes.join(" "),
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
  });
  return `https://${managementApiRegions[params.region]}/oauth/init?${query.toString()}`;
};

export const performOAuthLogin = async (options: {
  region: RegionCode;
  openBrowser?: (url: string) => Promise<unknown>;
}): Promise<OAuthLoginResult> => {
  const { region } = options;
  const openBrowser = options.openBrowser ?? ((url) => open(url));
  const ui = getUI();

  const client = resolveOAuthClient();
  const scopes = OAUTH_LOGIN_SCOPES;
  const { verifier, challenge } = generatePkce();
  const state = generateState();

  // Bind the callback port before opening the browser: no callback can be missed, and a port
  // conflict fails here rather than after sending the user through a consent screen whose
  // redirect the CLI could never have received.
  const listener = await startCallbackServer(OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH, state);

  const authorizeUrl = buildAuthorizeUrl({
    region,
    clientId: client.client_id,
    scopes,
    state,
    challenge,
  });
  ui.info(
    `Opening your browser to authorize the Storyblok CLI.\nIf it does not open, visit:\n${authorizeUrl}`,
  );
  try {
    await openBrowser(authorizeUrl);
  } catch (error) {
    listener.close();
    throw error;
  }

  // The callback server rejects a state mismatch itself, so reaching here means the state matched.
  const { code } = await listener.callback;

  const token = await exchangeToken(region, {
    grant_type: "authorization_code",
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
    auth_type: "oauth",
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: computeExpiresAt(token.expires_in),
  };
  // Mark this region as active in the same write, so the next session resolves here
  // rather than by fixed region order when several regions are authenticated.
  await updateOAuthEntry(region, { tokens, spaces: grant.spaces, activeRegion: true });

  return { region, scopes: grant.scopes, spaces: grant.spaces };
};
