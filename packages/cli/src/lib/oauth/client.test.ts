import { afterEach, describe, expect, it } from "vitest";
import { resolveOAuthClient } from "./client";
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from "./constants";

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

  it("should fall back to the baked-in first-party client when no env vars are set", () => {
    expect(resolveOAuthClient()).toEqual({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
    });
  });

  it("should ignore a partially configured env client", () => {
    process.env.STORYBLOK_OAUTH_CLIENT_ID = "env-id";
    expect(resolveOAuthClient()).toEqual({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
    });
  });
});
