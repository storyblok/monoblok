import { exchangeToken } from "./token-endpoint";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const handlers = [
  http.post("https://mapi.storyblok.com/oauth/token", async () => {
    return HttpResponse.json({
      access_token: "access-token-value",
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      scope: "read write",
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("exchangeToken", () => {
  it("should resolve with the access token and expires_in on a valid response", async () => {
    const result = await exchangeToken("eu", { grant_type: "authorization_code", code: "abc" });
    expect(result.access_token).toBe("access-token-value");
    expect(typeof result.expires_in).toBe("number");
    expect(result.expires_in).toBe(3600);
  });

  it("should reject with a CommandError when the response is missing access_token", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", async () => {
        return HttpResponse.json({
          expires_in: 3600,
        });
      }),
    );

    await expect(
      exchangeToken("eu", { grant_type: "authorization_code", code: "abc" }),
    ).rejects.toThrow(/missing or invalid: access_token/);
  });

  it("should not echo the response body when the token response is unusable", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", async () => {
        // A live token alongside a missing `expires_in`: the message reaches the log file too.
        return HttpResponse.json({ access_token: "sb_oat_secret_value" });
      }),
    );

    await expect(
      exchangeToken("eu", { grant_type: "authorization_code", code: "abc" }),
    ).rejects.toThrow(/^(?!.*sb_oat_secret_value).*missing or invalid: expires_in/s);
  });

  it("should tell the user to start a new login when an authorization code is rejected", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", async () => {
        return HttpResponse.json(
          {
            error: "invalid_grant",
            error_description:
              "The provided access grant is invalid, expired, or revoked (e.g. invalid assertion, expired authorization token, bad end-user password credentials, or mismatching authorization code and redirection URI).",
          },
          { status: 400 },
        );
      }),
    );

    // The server's boilerplate description is replaced by a remedy, not appended to it.
    await expect(
      exchangeToken("eu", { grant_type: "authorization_code", code: "abc" }),
    ).rejects.toThrow(
      /^(?!.*invalid assertion).*already used.*Run `storyblok login --oauth` to start a new one/s,
    );
  });

  it("should tell the user to sign in again when a refresh token is rejected", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", async () => {
        return HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
      }),
    );

    // `storyblok login` refuses while a session exists, so the logout has to be named.
    await expect(
      exchangeToken("eu", { grant_type: "refresh_token", refresh_token: "rt" }),
    ).rejects.toThrow(/Run `storyblok logout`, then `storyblok login --oauth`/);
  });

  it("should surface the server description for an unrecognized error code", async () => {
    server.use(
      http.post("https://mapi.storyblok.com/oauth/token", async () => {
        return HttpResponse.json(
          { error: "teapot", error_description: "I am a teapot" },
          { status: 418 },
        );
      }),
    );

    await expect(
      exchangeToken("eu", { grant_type: "authorization_code", code: "abc" }),
    ).rejects.toThrow(/\(teapot\): I am a teapot/);
  });
});
