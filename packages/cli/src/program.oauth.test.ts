// Integration coverage for the OAuth credential the shared preAction hook hands to the
// mapi client (see program.ts). The hook passes a provider rather than a token string,
// so the assertions here resolve that provider the way a request would.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

vi.mock("node:fs");
vi.mock("node:fs/promises");
// The shared test harness (test/setup.ts) mocks session() to a static logged-in PAT
// state. This suite needs the real session/oauth-store logic to load an expiring
// OAuth session from disk, so unmock it here, matching session.oauth.test.ts.
vi.unmock("./session");
// Capture the credential the mapi client is initialized with, without hitting the
// network via the real management-api-client.
vi.mock("./api", () => ({
  getMapiClient: vi.fn(),
}));

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const seedExpiringOAuthSession = () => {
  vol.fromJSON({
    [`${process.env.HOME}/.storyblok/oauth.json`]: JSON.stringify({
      oauth: {
        eu: {
          tokens: {
            auth_type: "oauth",
            access_token: "sb_oat_old",
            refresh_token: "sb_ort_old",
            // Well in the past, so isExpiringSoon() is true.
            expires_at: "2020-01-01T00:00:00.000Z",
          },
          spaces: [{ id: 5, region: "eu" }],
        },
      },
    }),
  });
};

const resolveProvidedToken = async (getMapiClient: unknown): Promise<string> => {
  const mock = getMapiClient as { mock: { calls: [{ oauthToken: () => Promise<string> }][] } };
  const [{ oauthToken }] = mock.mock.calls.at(-1)!;
  return oauthToken();
};

describe("program preAction OAuth refresh", () => {
  beforeEach(() => {
    vol.reset();
    vi.resetModules();
    // vi.resetModules() clears the dynamic-import cache, but the `./api` mock factory's
    // vi.fn() call history is tracked separately and survives it; clear it explicitly so
    // each test starts from zero calls.
    vi.clearAllMocks();
    delete process.env.STORYBLOK_LOGIN;
    delete process.env.STORYBLOK_TOKEN;
    delete process.env.STORYBLOK_REGION;
    // The baked-in client is still a placeholder, so the refresh path resolves its
    // credentials through the env-var override.
    process.env.STORYBLOK_OAUTH_CLIENT_ID = "cid";
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = "secret";
  });
  afterEach(() => {
    vol.reset();
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it("should refresh an expiring OAuth token when the credential is resolved", async () => {
    seedExpiringOAuthSession();
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", () =>
        HttpResponse.json({
          access_token: "sb_oat_new",
          refresh_token: "sb_ort_new",
          token_type: "bearer",
          expires_in: 900,
          scope: "stories:read offline_access",
        }),
      ),
    );

    const { getMapiClient } = await import("./api");
    const { getProgram } = await import("./program");
    const program = getProgram();
    program.command("oauth-test-refresh").action(() => {});

    await program.parseAsync(["node", "test", "oauth-test-refresh"]);

    expect(getMapiClient).toHaveBeenCalledWith(
      expect.objectContaining({ oauthToken: expect.any(Function), region: "eu" }),
    );
    await expect(resolveProvidedToken(getMapiClient)).resolves.toBe("sb_oat_new");

    // The rotated tokens are persisted before use.
    const { getOAuthEntry } = await import("./lib/oauth/store");
    const entry = await getOAuthEntry("eu");
    expect(entry.tokens?.access_token).toBe("sb_oat_new");
    expect(entry.tokens?.refresh_token).toBe("sb_ort_new");
  });

  it("should not refresh for a command that never resolves the credential", async () => {
    seedExpiringOAuthSession();
    let tokenEndpointCalls = 0;
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", () => {
        tokenEndpointCalls += 1;
        return HttpResponse.json({
          access_token: "sb_oat_new",
          refresh_token: "sb_ort_new",
          token_type: "bearer",
          expires_in: 900,
        });
      }),
    );

    const { getProgram } = await import("./program");
    const program = getProgram();
    program.command("oauth-test-no-request").action(() => {});

    await program.parseAsync(["node", "test", "oauth-test-no-request"]);

    expect(tokenEndpointCalls).toBe(0);
  });

  it("should surface the re-login guidance when the refresh fails", async () => {
    seedExpiringOAuthSession();
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );

    const { getProgram } = await import("./program");
    const program = getProgram();
    let actionRan = false;
    program.command("oauth-test-refresh-fail").action(() => {
      actionRan = true;
    });

    // A failing refresh must not reject the command run itself; commands that don't
    // need auth still work, and the failure surfaces where the credential is used.
    await expect(
      program.parseAsync(["node", "test", "oauth-test-refresh-fail"]),
    ).resolves.not.toThrow();
    expect(actionRan).toBe(true);

    const { getMapiClient } = await import("./api");
    await expect(resolveProvidedToken(getMapiClient)).rejects.toThrow(
      /Please run `storyblok login` again/,
    );
  });
});

const seedOAuthSessions = (regions: Record<string, string>) => {
  const oauth: Record<string, unknown> = { activeRegion: Object.keys(regions)[0] };
  for (const [region, accessToken] of Object.entries(regions)) {
    oauth[region] = {
      tokens: {
        auth_type: "oauth",
        access_token: accessToken,
        refresh_token: `${accessToken}_refresh`,
        // Far in the future, so no refresh interferes with the region assertions.
        expires_at: "2999-01-01T00:00:00.000Z",
      },
      spaces: [],
    };
  }
  vol.fromJSON({
    [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({ oauth }),
  });
};

describe("program preAction OAuth region reconciliation", () => {
  beforeEach(() => {
    vol.reset();
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.STORYBLOK_LOGIN;
    delete process.env.STORYBLOK_TOKEN;
    delete process.env.STORYBLOK_REGION;
  });
  afterEach(() => vol.reset());

  it("should refuse to run against a region the OAuth login does not cover", async () => {
    seedOAuthSessions({ eu: "sb_oat_eu" });

    const { getProgram } = await import("./program");
    const program = getProgram();
    let actionRan = false;
    program.command("oauth-test-region-mismatch").action(() => {
      actionRan = true;
    });

    await expect(
      program.parseAsync(["node", "test", "--region", "us", "oauth-test-region-mismatch"]),
    ).rejects.toThrow(/but region United States \(us\) was requested/);
    expect(actionRan).toBe(false);
  });

  it("should not reach the API with the wrong region's credential when the region is refused", async () => {
    seedOAuthSessions({ eu: "sb_oat_eu" });

    const { getProgram } = await import("./program");
    const program = getProgram();
    program.command("oauth-test-region-no-client").action(() => {});

    await expect(
      program.parseAsync(["node", "test", "--region", "us", "oauth-test-region-no-client"]),
    ).rejects.toThrow();

    const { getMapiClient } = await import("./api");
    expect(getMapiClient).not.toHaveBeenCalled();
  });

  it("should move the session to the requested region when that region is also authorized", async () => {
    seedOAuthSessions({ eu: "sb_oat_eu", us: "sb_oat_us" });

    const { getProgram } = await import("./program");
    const program = getProgram();
    program.command("oauth-test-region-switch").action(() => {});

    await program.parseAsync(["node", "test", "--region", "us", "oauth-test-region-switch"]);

    const { getMapiClient } = await import("./api");
    expect(getMapiClient).toHaveBeenCalledWith(
      expect.objectContaining({ oauthToken: expect.any(Function), region: "us" }),
    );
    await expect(resolveProvidedToken(getMapiClient)).resolves.toBe("sb_oat_us");
  });

  it("should use the active region when no region is requested", async () => {
    seedOAuthSessions({ eu: "sb_oat_eu", us: "sb_oat_us" });

    const { getProgram } = await import("./program");
    const program = getProgram();
    program.command("oauth-test-region-default").action(() => {});

    await program.parseAsync(["node", "test", "oauth-test-region-default"]);

    const { getMapiClient } = await import("./api");
    expect(getMapiClient).toHaveBeenCalledWith(
      expect.objectContaining({ oauthToken: expect.any(Function), region: "eu" }),
    );
    await expect(resolveProvidedToken(getMapiClient)).resolves.toBe("sb_oat_eu");
  });

  it("should let login pick a region the current session does not cover", async () => {
    seedOAuthSessions({ eu: "sb_oat_eu" });

    const { getProgram } = await import("./program");
    const program = getProgram();
    let actionRan = false;
    program.command("login").action(() => {
      actionRan = true;
    });

    await program.parseAsync(["node", "test", "--region", "us", "login"]);

    expect(actionRan).toBe(true);
  });
});
