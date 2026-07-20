import type { RegionCode } from '../../constants';
import { CommandError } from '../../utils';
import { getStoryblokUrl } from '../../utils/api-routes';
import type { OauthGrantSpace } from './store';

export interface GrantIntrospection {
  scopes: string[];
  expires_at: string;
  app: { client_id: string; name: string };
  spaces: OauthGrantSpace[];
}

// GET /v1/oauth/grant returns the scopes, expiry, client and granted spaces for the
// access token; the token response itself omits space ids (storyrails OauthGrantIntrospectionSerializer).
export const introspectGrant = async (region: RegionCode, accessToken: string): Promise<GrantIntrospection> => {
  const response = await fetch(`${getStoryblokUrl(region)}/oauth/grant`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new CommandError(`Grant introspection failed (${response.status} ${response.statusText}).`);
  }

  const data = await response.json() as GrantIntrospection;
  return {
    scopes: data.scopes ?? [],
    expires_at: data.expires_at,
    app: data.app,
    spaces: data.spaces ?? [],
  };
};
