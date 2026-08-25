import { getUser } from "./actions";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCredentialContext, setCredentialContext } from "../../utils";

const handlers = [
  http.get("https://mapi.storyblok.com/v1/users/me", async ({ request }) => {
    const token = request.headers.get("Authorization");
    if (token === "valid-token") {
      return HttpResponse.json({
        user: { data: "user data", name: "John Doe", friendly_name: "Johnny" },
      });
    }
    return new HttpResponse("Unauthorized", { status: 401 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  resetCredentialContext();
});
afterAll(() => server.close());

describe("user actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUser", () => {
    it("should get user successfully with a valid token", async () => {
      const mockResponse = { data: "user data", name: "John Doe", friendly_name: "Johnny" };
      const result = await getUser("valid-token", "eu");
      expect(result).toEqual(mockResponse);
    });
  });

  it("should throw an masked error for invalid token", async () => {
    await expect(getUser("invalid-token", "eu")).rejects.toThrow(
      "The token provided inva********* is invalid. Please make sure you are using the correct token and try again.",
    );
  });

  it("should throw a server error if response is 500", async () => {
    server.use(
      http.get("https://mapi.storyblok.com/v1/users/me", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    await expect(getUser("any-token", "eu")).rejects.toThrow("The server returned an error");
  });
});

describe("getUser credential errors", () => {
  it("should use the centralized message for an OAuth session", async () => {
    setCredentialContext({ kind: "oauth" });

    await expect(getUser({ oauthToken: "sb_oat_dead" }, "eu")).rejects.toThrow(
      "Your OAuth login is no longer valid",
    );
  });

  it("should use the centralized message for a PAT session", async () => {
    setCredentialContext({ kind: "pat" });

    await expect(getUser({ personalAccessToken: "sb_pat_dead" }, "eu")).rejects.toThrow(
      "Your personal access token was rejected",
    );
  });

  it("should keep the masked-token message while validating a token at login", async () => {
    // No session yet: the context is still unknown, so the matcher stays inactive.
    await expect(getUser("sb_pat_invalid", "eu")).rejects.toThrow("is invalid");
  });
});
