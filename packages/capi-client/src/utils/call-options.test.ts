import { describe, expect, it } from "vitest";
import { createClient, createConfig } from "../generated/capi/client";
import { buildCallOptions } from "./call-options";

describe("buildCallOptions", () => {
  const client = createClient(createConfig({ kyOptions: { timeout: 1000, retry: 3 } }));

  it("should forward nothing the caller did not set", () => {
    expect(buildCallOptions(client, undefined, undefined)).toEqual({});
  });

  it("should forward an explicit throwOnError, including false", () => {
    expect(buildCallOptions(client, false, undefined)).toEqual({ throwOnError: false });
  });

  it("should merge fetch options over the client's ky options", () => {
    expect(buildCallOptions(client, undefined, { timeout: 5000 })).toMatchObject({
      kyOptions: { timeout: 5000, retry: 3 },
    });
  });
});
