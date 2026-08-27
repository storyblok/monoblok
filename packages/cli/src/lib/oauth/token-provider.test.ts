import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OAuthTokens } from "./store";

const refreshOAuthTokens = vi.fn();
vi.mock("./refresh", () => ({
  refreshOAuthTokens: (...args: unknown[]) => refreshOAuthTokens(...args),
}));

const { createOAuthTokenProvider } = await import("./token-provider");

const inSeconds = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

const refreshedTo = (accessToken: string): OAuthTokens => ({
  auth_type: "oauth",
  access_token: accessToken,
  refresh_token: "sb_ort_new",
  expires_at: inSeconds(900),
});

describe("OAuth token provider", () => {
  beforeEach(() => {
    refreshOAuthTokens.mockReset();
  });

  it("should serve the stored token without refreshing while it is fresh", async () => {
    const state = { oauthAccessToken: "sb_oat_current", oauthExpiresAt: inSeconds(600) };

    await expect(createOAuthTokenProvider("eu", state)()).resolves.toBe("sb_oat_current");
    expect(refreshOAuthTokens).not.toHaveBeenCalled();
  });

  it("should wait for a refresh when the token is about to expire", async () => {
    refreshOAuthTokens.mockResolvedValue(refreshedTo("sb_oat_new"));
    const state = { oauthAccessToken: "sb_oat_old", oauthExpiresAt: inSeconds(30) };

    await expect(createOAuthTokenProvider("eu", state)()).resolves.toBe("sb_oat_new");
    expect(state.oauthAccessToken).toBe("sb_oat_new");
  });

  it("should keep serving the current token while refreshing in the background", async () => {
    let completeRefresh: (tokens: OAuthTokens) => void = () => {};
    refreshOAuthTokens.mockReturnValue(
      new Promise<OAuthTokens>((resolve) => {
        completeRefresh = resolve;
      }),
    );
    const state = { oauthAccessToken: "sb_oat_old", oauthExpiresAt: inSeconds(120) };
    const provideToken = createOAuthTokenProvider("eu", state);

    // The request is served immediately, without waiting for the refresh.
    await expect(provideToken()).resolves.toBe("sb_oat_old");
    await expect(provideToken()).resolves.toBe("sb_oat_old");
    expect(refreshOAuthTokens).toHaveBeenCalledTimes(1);

    completeRefresh(refreshedTo("sb_oat_new"));
    await vi.waitFor(() => expect(state.oauthAccessToken).toBe("sb_oat_new"));
    await expect(provideToken()).resolves.toBe("sb_oat_new");
  });

  it("should not fail a request when the background refresh fails", async () => {
    refreshOAuthTokens.mockRejectedValue(new Error("network down"));
    const state = { oauthAccessToken: "sb_oat_old", oauthExpiresAt: inSeconds(120) };

    await expect(createOAuthTokenProvider("eu", state)()).resolves.toBe("sb_oat_old");
  });

  it("should surface a failed refresh once the token can no longer be used", async () => {
    refreshOAuthTokens.mockRejectedValue(
      new Error("Your OAuth session has expired. Please run `storyblok login` again."),
    );
    const state = { oauthAccessToken: "sb_oat_old", oauthExpiresAt: inSeconds(10) };

    await expect(createOAuthTokenProvider("eu", state)()).rejects.toThrow(
      "Please run `storyblok login` again",
    );
  });
});
