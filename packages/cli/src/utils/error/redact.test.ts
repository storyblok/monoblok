import { ClientError } from "@storyblok/api-client";
import { describe, expect, it } from "vitest";
import { redactClientError, redactUrlTokens } from "./redact";

describe("redactUrlTokens", () => {
  it("should hide the token query parameter and keep the rest of the URL", () => {
    expect(
      redactUrlTokens(
        "Request timed out: GET https://api.storyblok.com/v2/cdn/stories?version=draft&token=abc123&per_page=25",
      ),
    ).toBe(
      "Request timed out: GET https://api.storyblok.com/v2/cdn/stories?version=draft&token=[redacted]&per_page=25",
    );
  });
});

describe("redactClientError", () => {
  // A transport failure rejects with the raw fetch error, whose message and
  // `request` carry the full request URL.
  it("should rebuild a transport error without the token or the request", () => {
    const timeout = Object.assign(
      new Error("Request timed out: GET https://api.storyblok.com/v2/cdn/stories?token=secret"),
      { name: "TimeoutError", request: { url: "https://api.storyblok.com/?token=secret" } },
    );

    const redacted = redactClientError(timeout);

    expect(redacted.name).toBe("TimeoutError");
    expect(redacted.message).not.toContain("secret");
    expect(redacted).not.toHaveProperty("request");
  });

  it("should return an HTTP error response unchanged", () => {
    const httpError = new ClientError("Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
      data: undefined,
    });

    expect(redactClientError(httpError)).toBe(httpError);
  });
});
