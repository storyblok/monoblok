import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import "../../index";
import { loginCommand } from "./index";
import { getOAuthEntry } from "../../lib/oauth/store";
import { session } from "../../session";
import { loggedOutSessionState } from "../../../test/setup";

vi.mock("node:fs");
vi.mock("node:fs/promises");
// Avoid opening a real browser and a real socket in tests.
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));
vi.mock("../../lib/oauth/server", () => ({
  startCallbackServer: vi.fn(async () => ({
    callback: Promise.resolve({ code: "auth-code", state: "ignored" }),
    close: vi.fn(),
  })),
}));
// Force the state check to pass by returning the same state generatePkce/generateState produced.
vi.mock("../../lib/oauth/pkce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/oauth/pkce")>();
  return { ...actual, generateState: () => "ignored" };
});

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("login --oauth", () => {
  beforeEach(async () => {
    vol.reset();
    // The shared test session mock defaults to a logged-in state; reset it so the login
    // command's "already logged in" guard does not short-circuit the oauth flow.
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
    // Point the CLI at a test client so the suite never depends on the baked-in one
    // through the env-var override that development and self-hosted setups use.
    process.env.STORYBLOK_OAUTH_CLIENT_ID = "cid";
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = "secret";
  });

  afterEach(() => {
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it("should complete the oauth flow and persist tokens and spaces", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", () =>
        HttpResponse.json({
          access_token: "sb_oat_x",
          refresh_token: "sb_ort_x",
          token_type: "bearer",
          expires_in: 900,
          scope: "stories:read offline_access",
        }),
      ),
      // The grant introspection payload is nested under a `grant` root key (storyrails).
      http.get("https://mapi.storyblok.com/v1/oauth/grant", () =>
        HttpResponse.json({
          grant: {
            scopes: ["stories:read", "offline_access"],
            expires_at: "2026-07-20T12:00:00.000Z",
            app: { client_id: "cid", name: "Storyblok CLI" },
            spaces: [{ id: 99, region: "eu" }],
          },
        }),
      ),
    );

    await loginCommand.parseAsync(["node", "test", "--oauth", "--region", "eu"]);

    const entry = await getOAuthEntry("eu");
    expect(entry.tokens?.access_token).toBe("sb_oat_x");
    expect(entry.spaces).toEqual([{ id: 99, region: "eu" }]);
  });

  it("should reject --oauth combined with --token instead of silently ignoring one", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await loginCommand.parseAsync(["node", "test", "--oauth", "--token", "pat", "--region", "eu"]);

    expect(errors.mock.calls.flat().join("\n")).toContain("two different login methods");
    // Neither method may have run.
    expect(await getOAuthEntry("eu")).toEqual({});
    errors.mockRestore();
  });
});
