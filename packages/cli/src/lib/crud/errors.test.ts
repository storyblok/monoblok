import { describe, expect, it } from "vitest";
import { stopsBatch, toCrudError } from "./errors";

describe("toCrudError with a network failure", () => {
  it("should say the API could not be reached, and stop the batch", () => {
    const failures = [
      new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND") }),
      Object.assign(new Error("Request timed out"), { name: "TimeoutError" }),
    ];

    for (const failure of failures) {
      const error = toCrudError(failure);
      expect(error.message).toMatch(/^Could not reach the Management API/);
      expect(stopsBatch(error)).toBe(true);
    }
  });

  it("should keep any other error as it is, without stopping the batch", () => {
    const error = toCrudError(new TypeError("Cannot read properties of undefined"));

    expect(error.message).toBe("Cannot read properties of undefined");
    expect(stopsBatch(error)).toBe(false);
  });
});
