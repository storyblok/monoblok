import type { RegionCode } from '../../constants';
import { managementApiRegions } from '../../constants';
import { CommandError } from '../../utils';
import { customFetch, FetchError } from '../../utils/fetch';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  raw: Record<string, unknown>;
}

export const exchangeToken = async (region: RegionCode, params: Record<string, string>): Promise<TokenResponse> => {
  // The token endpoint lives at the API root, not under `/v1`, so build the URL
  // from the region host directly rather than via `getStoryblokUrl`.
  let raw: Record<string, unknown>;
  try {
    const { perPage, total, ...data } = await customFetch<Record<string, unknown>>(
      `https://${managementApiRegions[region]}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      },
    );
    raw = data;
  }
  catch (error) {
    if (error instanceof FetchError) {
      const data = error.response.data;
      const errorCode = data && typeof data.error === 'string' ? data.error : `${error.response.status}`;
      throw new CommandError(`Token endpoint error (${errorCode}): ${JSON.stringify(data ?? {})}`);
    }
    throw error;
  }

  if (typeof raw.access_token !== 'string' || typeof raw.expires_in !== 'number') {
    throw new CommandError(`Token endpoint returned an unexpected shape: ${JSON.stringify(raw)}`);
  }

  return {
    access_token: raw.access_token,
    refresh_token: typeof raw.refresh_token === 'string' ? raw.refresh_token : undefined,
    expires_in: raw.expires_in,
    scope: typeof raw.scope === 'string' ? raw.scope : undefined,
    raw,
  };
};

// Revokes a token server-side (RFC 7009). Revoking the refresh token invalidates the
// whole grant, so a logged-out session can no longer mint new tokens. Like the token
// endpoint, `/oauth/revoke` lives at the API root rather than under `/v1`.
// Uses a raw fetch rather than `customFetch`: a successful revocation returns `200` with
// an empty body (RFC 7009 §2.2 / storyrails `head :ok`), which `customFetch` would reject
// as a non-JSON response.
export const revokeToken = async (region: RegionCode, token: string, client: { client_id: string; client_secret: string }): Promise<void> => {
  const response = await fetch(`https://${managementApiRegions[region]}/oauth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token,
      client_id: client.client_id,
      client_secret: client.client_secret,
    }).toString(),
  });
  if (!response.ok) {
    throw new CommandError(`Revocation endpoint error (${response.status} ${response.statusText}).`);
  }
};
