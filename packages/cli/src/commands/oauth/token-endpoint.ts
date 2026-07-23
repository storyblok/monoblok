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
