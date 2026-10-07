import { describe, expect, it } from "vitest";
import { ClientError } from "../errors";
import { buildCallOptions, createErrorInterceptor, withResponseFallbacks } from ".";

describe("createErrorInterceptor", () => {
  it("should wrap an HTTP error response in a ClientError carrying the body", () => {
    const intercept = createErrorInterceptor(false);
    const response = new Response(null, { status: 404, statusText: "Not Found" });

    const error = intercept({ error: "missing" }, response, undefined, {});

    expect(error).toBeInstanceOf(ClientError);
    expect(error).toMatchObject({
      message: "Not Found",
      response: { status: 404, data: { error: "missing" } },
    });
  });

  it("should pass a transport failure through when the client throws on error", () => {
    const transportError = new TypeError("fetch failed");

    expect(createErrorInterceptor(true)(transportError, undefined, undefined, {})).toBe(
      transportError,
    );
  });

  it("should let the call override the client's throwOnError default", () => {
    const transportError = new TypeError("fetch failed");
    const intercept = createErrorInterceptor(true);

    const error = intercept(transportError, undefined, undefined, { throwOnError: false });

    expect(error).toBeInstanceOf(ClientError);
    expect(error).toMatchObject({ response: { status: 0 }, cause: transportError });
  });
});

describe("withResponseFallbacks", () => {
  it("should keep the response and request of a result that has them", () => {
    const response = new Response(null);
    const request = new Request("https://api.storyblok.com/v2/cdn/stories");

    expect(withResponseFallbacks({ response, request }, "https://example.com")).toEqual({
      response,
      request,
    });
  });

  it("should fill in a network error response and a request to the base URL", () => {
    const result = withResponseFallbacks({}, "https://api.storyblok.com/v2");

    expect(result.response.type).toBe("error");
    expect(result.request.url).toBe("https://api.storyblok.com/v2");
  });

  it("should fall back to about:blank for a malformed base URL", () => {
    expect(withResponseFallbacks({}, "not a url").request.url).toBe("about:blank");
  });
});

describe("buildCallOptions", () => {
  const client = { getConfig: () => ({ kyOptions: { timeout: 1000, retry: 3 } }) };

  it("should forward nothing the caller did not set", () => {
    expect(buildCallOptions(client, undefined, undefined)).toEqual({});
  });

  it("should forward an explicit throwOnError, including false", () => {
    expect(buildCallOptions(client, false, undefined)).toEqual({ throwOnError: false });
  });

  it("should merge fetch options over the client's ky options", () => {
    expect(buildCallOptions(client, undefined, { timeout: 5000 })).toEqual({
      kyOptions: { timeout: 5000, retry: 3 },
    });
  });
});
