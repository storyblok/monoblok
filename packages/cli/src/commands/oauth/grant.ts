import type { RegionCode } from '../../constants';
import { CommandError } from '../../utils';
import { customFetch, FetchError } from '../../utils/fetch';
import { getStoryblokUrl } from '../../utils/api-routes';
import type { OAuthGrantSpace } from './store';

export interface GrantIntrospection {
  scopes: string[];
  expires_at: string;
  app: { client_id: string; name: string };
  spaces: OAuthGrantSpace[];
}

// GET /v1/oauth/grant returns the scopes, expiry, client and granted spaces for the
// access token; the token response itself omits space ids (storyrails OauthGrantIntrospectionSerializer).
// The payload is nested under a `grant` root key (storyrails oauth_controller renders
// `root: "grant", adapter: :json`), so unwrap it before reading the fields.
export const introspectGrant = async (region: RegionCode, accessToken: string): Promise<GrantIntrospection> => {
  let body: { grant?: GrantIntrospection };
  try {
    body = await customFetch<{ grant?: GrantIntrospection }>(`${getStoryblokUrl(region)}/oauth/grant`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  catch (error) {
    if (error instanceof FetchError) {
      throw new CommandError(`Grant introspection failed (${error.response.status} ${error.response.statusText}).`);
    }
    throw error;
  }

  const data = body.grant ?? ({} as Partial<GrantIntrospection>);
  return {
    scopes: data.scopes ?? [],
    expires_at: data.expires_at ?? '',
    app: data.app ?? { client_id: '', name: '' },
    spaces: data.spaces ?? [],
  };
};
