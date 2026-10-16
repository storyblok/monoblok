import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { computeExpiresAt, refreshOAuthTokens } from "./refresh";
import { getOAuthEntry, updateOAuthEntry } from "./store";

vi.mock("node:fs");
vi.mock("node:fs/promises");

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("computeExpiresAt", () => {
  it("should add the lifetime in seconds to now", () => {
    expect(computeExpiresAt(900, Date.parse("2026-07-20T00:00:00.000Z"))).toBe(
      "2026-07-20T00:15:00.000Z",
    );
  });
});

describe("refreshOAuthTokens", () => {
  beforeEach(async () => {
    vol.reset();
    // The baked-in client is still a placeholder, so the refresh resolves its
    // credentials through the env-var override.
    process.env.STORYBLOK_OAUTH_CLIENT_ID = "cid";
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = "secret";
    await updateOAuthEntry("eu", {
      tokens: {
        auth_type: "oauth",
        access_token: "old-access",
        refresh_token: "old-refresh",
        expires_at: "2026-07-20T00:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it("should not call the token endpoint when the stored token is still valid", async () => {
    // Stands in for another process having refreshed while this one waited for the lock.
    await updateOAuthEntry("eu", {
      tokens: {
        auth_type: "oauth",
        access_token: "fresh-access",
        refresh_token: "fresh-refresh",
        expires_at: computeExpiresAt(900),
      },
    });
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", () => {
        throw new Error("the token endpoint must not be called");
      }),
    );

    await expect(refreshOAuthTokens("eu")).resolves.toMatchObject({
      access_token: "fresh-access",
    });
  });

  it("should key single-flight refresh by region so concurrent regions do not share a promise", async () => {
    await updateOAuthEntry("us", {
      tokens: {
        auth_type: "oauth",
        access_token: "us-old-access",
        refresh_token: "us-old-refresh",
        expires_at: "2026-07-20T00:00:00.000Z",
      },
    });

    server.use(
      // eu and us resolve to distinct hosts (mapi.storyblok.com vs api-us.storyblok.com),
      // so each handler only ever serves its own region's refresh request.
      http.post("https://mapi.storyblok.com/oauth/token", () =>
        HttpResponse.json({
          access_token: "eu-new-access",
          refresh_token: "eu-new-refresh",
          token_type: "bearer",
          expires_in: 900,
          scope: "stories:read",
        }),
      ),
      http.post("https://api-us.storyblok.com/oauth/token", () =>
        HttpResponse.json({
          access_token: "us-new-access",
          refresh_token: "us-new-refresh",
          token_type: "bearer",
          expires_in: 900,
          scope: "stories:read",
        }),
      ),
    );

    const [euTokens, usTokens] = await Promise.all([
      refreshOAuthTokens("eu"),
      refreshOAuthTokens("us"),
    ]);

    expect(euTokens.access_token).toBe("eu-new-access");
    expect(usTokens.access_token).toBe("us-new-access");
  });

  it("should persist the rotated refresh token before returning the new access token", async () => {
    let persistedRefreshAtRequestTime: string | undefined;
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", async () => {
        persistedRefreshAtRequestTime = (await getOAuthEntry("eu")).tokens?.refresh_token;
        return HttpResponse.json({
          access_token: "new-access",
          refresh_token: "new-refresh",
          token_type: "bearer",
          expires_in: 900,
          scope: "stories:read",
        });
      }),
    );

    const tokens = await refreshOAuthTokens("eu");
    expect(tokens.access_token).toBe("new-access");
    // Before the exchange resolves, the store still had the old refresh token.
    expect(persistedRefreshAtRequestTime).toBe("old-refresh");
    // After the call, the rotated refresh token is persisted.
    expect((await getOAuthEntry("eu")).tokens?.refresh_token).toBe("new-refresh");
  });

  it("should throw a re-login error when the refresh grant is invalid", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );
    await expect(refreshOAuthTokens("eu")).rejects.toThrow(/storyblok login/);
  });

  it("should throw when there is no stored refresh token", async () => {
    await updateOAuthEntry("eu", {
      tokens: { auth_type: "oauth", access_token: "a", expires_at: "x" },
    });
    await expect(refreshOAuthTokens("eu")).rejects.toThrow();
  });
});
