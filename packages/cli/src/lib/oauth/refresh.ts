import type { RegionCode } from "../../constants";
import {
  oauthPath,
  readCredentialsFile,
  withCredentialsLock,
  writeCredentialsFile,
} from "../../credentials-file";
import { CommandError } from "../../utils";
import { resolveOAuthClient } from "./client";
import { isExpiringSoon } from "./expiry";
import { applyOAuthEntry, readOAuthEntry } from "./store";
import type { OAuthTokens } from "./store";
import { exchangeToken } from "./token-endpoint";

export const computeExpiresAt = (expiresInSeconds: number, nowMs: number = Date.now()): string => {
  return new Date(nowMs + expiresInSeconds * 1000).toISOString();
};

// In-process single-flight, keyed by region: concurrent callers for the same
// region within one CLI process share one refresh, but different regions don't.
const inFlight = new Map<RegionCode, Promise<OAuthTokens>>();

// A refresh token is single-use and rotates, so the whole read-exchange-persist cycle
// runs under the credentials lock: two processes refreshing at once would each present
// the same token, and the loser's `invalid_grant` ends the session for good.
const doRefresh = async (region: RegionCode): Promise<OAuthTokens> =>
  withCredentialsLock(async () => {
    const entry = readOAuthEntry(await readCredentialsFile(oauthPath()), region);

    // Another process may have refreshed while this one waited for the lock.
    if (entry.tokens && !isExpiringSoon(entry.tokens.expires_at)) {
      return entry.tokens;
    }

    const refreshToken = entry.tokens?.refresh_token;
    if (!refreshToken) {
      throw new CommandError(
        "No OAuth refresh token stored. Run `storyblok login` to authenticate.",
      );
    }

    const client = resolveOAuthClient();

    let response;
    try {
      response = await exchangeToken(region, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: client.client_id,
        client_secret: client.client_secret,
      });
    } catch (error) {
      // The refresh token rotates and is single-use; an invalid grant means the session is dead.
      if (error instanceof CommandError && /invalid_grant/.test(error.message)) {
        throw new CommandError(
          "Your OAuth session has expired. Please run `storyblok login` again.",
        );
      }
      throw error;
    }

    const tokens: OAuthTokens = {
      auth_type: "oauth",
      access_token: response.access_token,
      refresh_token: response.refresh_token ?? refreshToken,
      expires_at: computeExpiresAt(response.expires_in),
    };

    // Persist the rotated tokens BEFORE returning them for use. Re-read inside the lock
    // so a concurrent PAT login in the same file is not overwritten.
    await writeCredentialsFile(
      applyOAuthEntry(await readCredentialsFile(oauthPath()), region, { tokens }),
      oauthPath(),
    );
    return tokens;
  }, oauthPath());

export const refreshOAuthTokens = async (region: RegionCode): Promise<OAuthTokens> => {
  if (inFlight.has(region)) {
    return inFlight.get(region)!;
  }
  const promise = doRefresh(region).finally(() => {
    inFlight.delete(region);
  });
  inFlight.set(region, promise);
  return promise;
};
