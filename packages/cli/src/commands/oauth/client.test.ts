import { afterEach, describe, expect, it } from "vitest";
import { resolveOAuthClient } from "./client";
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_PLACEHOLDER_PREFIX } from "./constants";

describe("resolveOAuthClient", () => {
  afterEach(() => {
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it("should prefer env-var client credentials over the baked-in client", () => {
    process.env.STORYBLOK_OAUTH_CLIENT_ID = "env-id";
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = "env-secret";
    expect(resolveOAuthClient()).toEqual({ client_id: "env-id", client_secret: "env-secret" });
  });

  // Until the first-party app is registered, the baked-in values are placeholders. Once they
  // are replaced this expectation flips to returning them, and the guard becomes unreachable.
  it("should explain that the build ships without credentials while the client is a placeholder", () => {
    expect(OAUTH_CLIENT_ID.startsWith(OAUTH_CLIENT_PLACEHOLDER_PREFIX)).toBe(true);
    expect(() => resolveOAuthClient()).toThrow(/ships without OAuth client credentials/);
  });
});
