import type { RegionCode } from '../../constants';
import { managementApiRegions } from '../../constants';
import { CommandError } from '../../utils';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  raw: Record<string, unknown>;
}

export const exchangeToken = async (region: RegionCode, params: Record<string, string>): Promise<TokenResponse> => {
  const response = await fetch(`https://${managementApiRegions[region]}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const text = await response.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  }
  catch {
    throw new CommandError(`Token endpoint returned non-JSON (${response.status} ${response.statusText}): ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new CommandError(`Token endpoint error ${response.status}: ${JSON.stringify(raw)}`);
  }

  return {
    access_token: raw.access_token as string,
    refresh_token: raw.refresh_token as string | undefined,
    expires_in: raw.expires_in as number,
    scope: raw.scope as string | undefined,
    raw,
  };
};
