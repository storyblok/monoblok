import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { OAUTH_LOGIN_SCOPES } from "./constants";
import { buildAuthorizeUrl, performOAuthLogin } from "./login-flow";
import { getOAuthActiveRegion, getOAuthEntry } from "./store";

vi.mock("node:fs");
vi.mock("node:fs/promises");
vi.mock("../ui", () => ({ getUI: () => ({ info: vi.fn(), warn: vi.fn() }) }));
vi.mock("./client", () => ({
  resolveOAuthClient: vi.fn(() => ({ client_id: "cid", client_secret: "sec" })),
}));
vi.mock("./pkce", () => ({
  generatePkce: () => ({ verifier: "verifier", challenge: "challenge" }),
  generateState: () => "state-abc",
}));
vi.mock("./server", () => ({
  startCallbackServer: vi.fn(async () => ({
    callback: Promise.resolve({ code: "auth-code", state: "state-abc" }),
    close: vi.fn(),
  })),
}));
vi.mock("./token-endpoint", () => ({
  exchangeToken: vi.fn(async () => ({ access_token: "at", refresh_token: "rt", expires_in: 900 })),
}));
vi.mock("./grant", () => ({ introspectGrant: vi.fn() }));

const { introspectGrant } = await import("./grant");
const { resolveOAuthClient } = await import("./client");
const { startCallbackServer } = await import("./server");

describe("buildAuthorizeUrl", () => {
  it("should build an /oauth/init URL with PKCE and space-safe params", () => {
    const url = new URL(
      buildAuthorizeUrl({
        region: "eu",
        clientId: "cid",
        scopes: ["stories:read", "offline_access"],
        state: "st",
        challenge: "ch",
      }),
    );
    expect(url.host).toBe("mapi.storyblok.com");
    expect(url.pathname).toBe("/oauth/init");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("stories:read offline_access");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4900/oauth/callback");
    expect(url.searchParams.get("state")).toBe("st");
  });
});

describe("performOAuthLogin", () => {
  beforeEach(() => vol.reset());
  afterEach(() => vol.reset());

  it("should persist tokens and granted spaces after a successful introspection", async () => {
    vi.mocked(introspectGrant).mockResolvedValueOnce({
      scopes: ["stories:read"],
      spaces: [{ id: 5, region: "eu" }],
    });

    const result = await performOAuthLogin({ region: "eu", openBrowser: async () => {} });

    expect(result.spaces).toEqual([{ id: 5, region: "eu" }]);
    const entry = await getOAuthEntry("eu");
    expect(entry.tokens?.access_token).toBe("at");
    expect(entry.spaces).toEqual([{ id: 5, region: "eu" }]);
  });

  it("should mark the region as active after a successful login", async () => {
    vi.mocked(introspectGrant).mockResolvedValueOnce({ scopes: ["stories:read"], spaces: [] });

    await performOAuthLogin({ region: "us", openBrowser: async () => {} });

    expect(await getOAuthActiveRegion()).toBe("us");
  });

  it("should authorize with the resolved client id and the full CLI scope set", async () => {
    vi.mocked(resolveOAuthClient).mockReturnValueOnce({
      client_id: "env-cid",
      client_secret: "env-sec",
    });
    vi.mocked(introspectGrant).mockResolvedValueOnce({ scopes: [], spaces: [] });

    let authorizeUrl = "";
    await performOAuthLogin({
      region: "eu",
      openBrowser: async (url) => {
        authorizeUrl = url;
      },
    });

    const params = new URL(authorizeUrl).searchParams;
    expect(params.get("client_id")).toBe("env-cid");
    expect(params.get("scope")).toBe(OAUTH_LOGIN_SCOPES.join(" "));
  });

  it("should not open a browser when the callback port cannot be bound", async () => {
    vi.mocked(startCallbackServer).mockRejectedValueOnce(
      new Error("Port 4900 is already in use by nc (PID 1)"),
    );
    const openBrowser = vi.fn(async () => {});

    await expect(performOAuthLogin({ region: "eu", openBrowser })).rejects.toThrow(
      "already in use",
    );

    // Sending a user through consent whose redirect can never be received is worse than
    // failing before the tab opens.
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it("should not persist tokens when introspection fails", async () => {
    vi.mocked(introspectGrant).mockRejectedValueOnce(new Error("introspection failed"));

    await expect(performOAuthLogin({ region: "eu", openBrowser: async () => {} })).rejects.toThrow(
      "introspection failed",
    );

    expect(await getOAuthEntry("eu")).toEqual({});
    expect(await getOAuthActiveRegion()).toBeUndefined();
  });
});
