import type { RegionCode } from '../../constants';
import { getStoryblokUrl } from '../../utils/api-routes';
import { customFetch, FetchError } from '../../utils/fetch';
import { CommandError, konsola } from '../../utils';
import { OAUTH_APP_NAME, OAUTH_REDIRECT_URI } from './constants';
import type { OauthClientCredentials } from './store';

interface OauthClientSummary {
  id: number;
  name: string;
}

interface OauthClientDetail extends OauthClientSummary {
  oauth_identifier: string;
  oauth_secret?: string;
}

interface OauthClientsListResponse {
  oauth_clients: OauthClientSummary[];
}

interface OauthClientResponse {
  oauth_client: OauthClientDetail;
}

interface ScopeGroup {
  resource: string;
  actions: string[];
}

interface ScopeMetadataResponse {
  available_scopes: ScopeGroup[];
  additional_scopes: string[];
}

const patHeaders = (pat: string) => ({ Authorization: pat });

// Scope strings are built as `resource:action` from the grouped catalog
// (storyrails token_scopeable.rb VALID_SCOPES).
export const fetchScopeCatalog = async (pat: string, region: RegionCode): Promise<string[]> => {
  const url = getStoryblokUrl(region);
  const { available_scopes, additional_scopes } = await customFetch<ScopeMetadataResponse>(
    `${url}/oauth_clients/metadata`,
    { headers: patHeaders(pat) },
  );
  konsola.info(`Raw scope metadata: ${JSON.stringify({ available_scopes, additional_scopes })}`);
  const flat = available_scopes.flatMap(group => group.actions.map(action => `${group.resource}:${action}`));
  const scopes = [...new Set([...flat, ...additional_scopes])];
  konsola.info(`Resolved allowed_scopes (${scopes.length}): ${scopes.join(' ')}`);
  return scopes;
};

export const findOrCreateCliClient = async (pat: string, region: RegionCode): Promise<OauthClientCredentials> => {
  const url = getStoryblokUrl(region);
  const headers = patHeaders(pat);

  try {
    const { oauth_clients } = await customFetch<OauthClientsListResponse>(`${url}/oauth_clients`, { headers });
    const existing = oauth_clients.find(client => client.name === OAUTH_APP_NAME);
    const scopes = await fetchScopeCatalog(pat, region);

    if (existing) {
      const { oauth_client } = await customFetch<OauthClientResponse>(`${url}/oauth_clients/${existing.id}`, { headers });
      if (!oauth_client.oauth_secret) {
        throw new CommandError(`Found existing "${OAUTH_APP_NAME}" app (id ${existing.id}) but the response did not include a secret. Record this in the findings doc.`);
      }
      return { client_id: oauth_client.oauth_identifier, client_secret: oauth_client.oauth_secret, scopes };
    }

    const { oauth_client } = await customFetch<OauthClientResponse>(`${url}/oauth_clients`, {
      method: 'POST',
      headers,
      body: {
        oauth_client: {
          name: OAUTH_APP_NAME,
          // App validates slug format with no allow_blank and global uniqueness,
          // so creates need a unique slug (storyrails app.rb).
          slug: `storyblok-cli-${Date.now().toString(36)}`,
          oauth_redirect_uri: OAUTH_REDIRECT_URI,
          allowed_scopes: scopes,
        },
      },
    });
    if (!oauth_client.oauth_secret) {
      throw new CommandError('Created app but the response did not include a secret. Record this in the findings doc.');
    }
    return { client_id: oauth_client.oauth_identifier, client_secret: oauth_client.oauth_secret, scopes };
  }
  catch (error) {
    if (error instanceof FetchError && error.response.status === 403) {
      const backendMessage = JSON.stringify(error.response.data);
      throw new CommandError(
        `Access to /v1/oauth_clients was denied (403): ${backendMessage}\n`
        + `Managing OAuth clients requires an org manager role and the org must be enabled for OAuth grants.\n`
        + `If you are not an org manager, ask your org admin for a client id + secret and run:\n`
        + `  storyblok oauth setup --client-id <id> --client-secret <secret>`,
      );
    }
    if (error instanceof FetchError) {
      // Surface the raw error body — it's runbook evidence (e.g. 422 validation shapes).
      throw new CommandError(
        `/v1/oauth_clients request failed (${error.response.status} ${error.response.statusText}): ${JSON.stringify(error.response.data)}`,
      );
    }
    throw error;
  }
};
