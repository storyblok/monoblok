import type { RegionCode } from "../../constants";
import { managementApiRegions } from "../../constants";
import { CommandError, formatReloginSteps } from "../../utils";
import { customFetch, FetchError } from "../../utils/fetch";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  raw: Record<string, unknown>;
}

const readString = (source: unknown, key: string): string | undefined => {
  const value =
    source && typeof source === "object" ? (source as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : undefined;
};

// RFC 6749 §5.2 codes whose remedy does not depend on which grant was being exchanged. Their
// `error_description` is boilerplate, so these deliberately replace it rather than append to it.
const GRANT_ERROR_REMEDIES: Record<string, string> = {
  invalid_client:
    "Storyblok rejected the CLI's OAuth client. If STORYBLOK_OAUTH_CLIENT_ID and STORYBLOK_OAUTH_CLIENT_SECRET are set, check them; otherwise update the CLI.",
  invalid_scope:
    "Storyblok rejected one of the permissions the CLI requested. Update the CLI, or ask an organization owner whether these scopes are enabled for your account.",
  unauthorized_client:
    "The CLI's OAuth client is not allowed to use this grant type. Update the CLI to a newer version.",
  unsupported_grant_type:
    "Storyblok does not support the grant type the CLI used. Update the CLI to a newer version.",
};

/**
 * Turns a token-endpoint failure into something a user can act on. `invalid_grant` is the
 * common case and means something different per grant type: a spent or expired authorization
 * code during login, versus a dead session during a refresh.
 */
export const formatTokenEndpointError = (
  grantType: string | undefined,
  status: number,
  data: unknown,
): string => {
  const code = readString(data, "error");
  const description = readString(data, "error_description");

  if (code === "invalid_grant") {
    return grantType === "refresh_token"
      ? `Your OAuth session is no longer valid, it may have expired or been revoked. ${formatReloginSteps("storyblok login --oauth")} to sign in again.`
      : "The authorization from your browser has expired or was already used. Run `storyblok login --oauth` to start a new one.";
  }

  const remedy = code ? GRANT_ERROR_REMEDIES[code] : undefined;
  if (remedy) {
    return remedy;
  }

  // Nothing is known about this code, so the server's own description is the only
  // information worth showing.
  const cause = code ?? `HTTP ${status}`;
  return description
    ? `Storyblok rejected the OAuth token request (${cause}): ${description}`
    : `Storyblok rejected the OAuth token request (${cause}).`;
};

export const exchangeToken = async (
  region: RegionCode,
  params: Record<string, string>,
): Promise<TokenResponse> => {
  // The token endpoint lives at the API root, not under `/v1`, so build the URL
  // from the region host directly rather than via `getStoryblokUrl`.
  let raw: Record<string, unknown>;
  try {
    const { perPage, total, ...data } = await customFetch<Record<string, unknown>>(
      `https://${managementApiRegions[region]}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      },
    );
    raw = data;
  } catch (error) {
    if (error instanceof FetchError) {
      throw new CommandError(
        formatTokenEndpointError(params.grant_type, error.response.status, error.response.data),
      );
    }
    throw error;
  }

  if (typeof raw.access_token !== "string" || typeof raw.expires_in !== "number") {
    // Named fields only: the response body holds live tokens, and this message reaches both
    // the terminal and the log file on disk.
    const invalidFields = [
      typeof raw.access_token !== "string" ? "access_token" : undefined,
      typeof raw.expires_in !== "number" ? "expires_in" : undefined,
    ].filter((field): field is string => field !== undefined);
    throw new CommandError(
      `Storyblok returned an OAuth token response the CLI cannot use (missing or invalid: ${invalidFields.join(", ")}).`,
    );
  }

  return {
    access_token: raw.access_token,
    refresh_token: typeof raw.refresh_token === "string" ? raw.refresh_token : undefined,
    expires_in: raw.expires_in,
    scope: typeof raw.scope === "string" ? raw.scope : undefined,
    raw,
  };
};

// Revokes a token server-side (RFC 7009). Revoking the refresh token invalidates the
// whole grant, so a logged-out session can no longer mint new tokens. Like the token
// endpoint, `/oauth/revoke` lives at the API root rather than under `/v1`.
// Uses a raw fetch rather than `customFetch`: a successful revocation returns `200` with
// an empty body (RFC 7009 §2.2 / storyrails `head :ok`), which `customFetch` would reject
// as a non-JSON response.
export const revokeToken = async (
  region: RegionCode,
  token: string,
  client: { client_id: string; client_secret: string },
): Promise<void> => {
  const response = await fetch(`https://${managementApiRegions[region]}/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      client_id: client.client_id,
      client_secret: client.client_secret,
    }).toString(),
  });
  if (!response.ok) {
    throw new CommandError(
      `Revocation endpoint error (${response.status} ${response.statusText}).`,
    );
  }
};
