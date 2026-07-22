import type { RegionCode } from '../../constants';
import { CommandError } from '../../utils';
import { customFetch, FetchError } from '../../utils/fetch';
import { getStoryblokUrl } from '../../utils/api-routes';
import { getLogger } from '../../lib/logger/logger';
import { OAUTH_APP_NAME, OAUTH_REDIRECT_URI } from './constants';
import type { OAuthClientCredentials } from './store';

interface OAuthClientSummary {
  id: number;
  name: string;
}

interface OAuthClientDetail extends OAuthClientSummary {
  oauth_identifier: string;
  oauth_secret?: string;
}

interface OAuthClientsListResponse {
  oauth_clients: OAuthClientSummary[];
}

interface OAuthClientResponse {
  oauth_client: OAuthClientDetail;
}

interface ScopeGroup {
  resource: string;
  actions: string[];
}

interface ScopeMetadataResponse {
  available_scopes: ScopeGroup[];
  additional_scopes: string[];
}

const patHeaders = (pat: string): Record<string, string> => ({ Authorization: pat });

// Scope strings are `resource:action` built from the grouped catalog (storyrails token_scopeable.rb VALID_SCOPES).
export const fetchScopeCatalog = async (pat: string, region: RegionCode): Promise<string[]> => {
  const url = getStoryblokUrl(region);
  const { available_scopes, additional_scopes } = await customFetch<ScopeMetadataResponse>(
    `${url}/oauth_clients/metadata`,
    { headers: patHeaders(pat) },
  );
  const flat = available_scopes.flatMap(group => group.actions.map(action => `${group.resource}:${action}`));
  const scopes = [...new Set([...flat, ...additional_scopes])];
  getLogger().info('Resolved OAuth scope catalog', { count: scopes.length });
  return scopes;
};

export const findOrCreateCliClient = async (pat: string, region: RegionCode): Promise<OAuthClientCredentials> => {
  const url = getStoryblokUrl(region);
  const headers = patHeaders(pat);

  try {
    const { oauth_clients } = await customFetch<OAuthClientsListResponse>(`${url}/oauth_clients`, { headers });
    const existing = oauth_clients.find(client => client.name === OAUTH_APP_NAME);
    const scopes = await fetchScopeCatalog(pat, region);

    if (existing) {
      const { oauth_client } = await customFetch<OAuthClientResponse>(`${url}/oauth_clients/${existing.id}`, { headers });
      if (!oauth_client.oauth_secret) {
        throw new CommandError(`Found existing "${OAUTH_APP_NAME}" app (id ${existing.id}) but the response did not include a secret.`);
      }
      return { client_id: oauth_client.oauth_identifier, client_secret: oauth_client.oauth_secret, scopes };
    }

    const { oauth_client } = await customFetch<OAuthClientResponse>(`${url}/oauth_clients`, {
      method: 'POST',
      headers,
      body: {
        oauth_client: {
          name: OAUTH_APP_NAME,
          // App validates slug format with no allow_blank plus global uniqueness (storyrails app.rb).
          slug: `storyblok-cli-${Date.now().toString(36)}`,
          oauth_redirect_uri: OAUTH_REDIRECT_URI,
          allowed_scopes: scopes,
        },
      },
    });
    if (!oauth_client.oauth_secret) {
      throw new CommandError('Created the app but the response did not include a secret.');
    }
    return { client_id: oauth_client.oauth_identifier, client_secret: oauth_client.oauth_secret, scopes };
  }
  catch (error) {
    if (error instanceof FetchError && error.response.status === 403) {
      throw new CommandError(
        `Access to /v1/oauth_clients was denied (403): ${JSON.stringify(error.response.data)}\n`
        + `Managing OAuth clients requires an org manager role and the org must be enabled for OAuth grants.\n`
        + `If you are not an org manager, ask your org admin for a client id and secret and run:\n`
        + `  storyblok oauth setup --client-id <id> --client-secret <secret>`,
      );
    }
    if (error instanceof FetchError) {
      throw new CommandError(
        `/v1/oauth_clients request failed (${error.response.status} ${error.response.statusText}): ${JSON.stringify(error.response.data)}`,
      );
    }
    throw error;
  }
};
