import { describe, expect, it } from "vitest";
import { createTokenId } from "./token-id";

describe("createTokenId", () => {
  it("should be stable for the same token", () => {
    expect(createTokenId("OurklwV5XsDJTIE1NJaD2wtt")).toBe(
      createTokenId("OurklwV5XsDJTIE1NJaD2wtt"),
    );
  });

  it("should differ for different tokens", () => {
    expect(createTokenId("token-a")).not.toBe(createTokenId("token-b"));
  });

  it("should differ for tokens that differ only in one character", () => {
    expect(createTokenId("aaaaaaaaaaaaaaaaaaaaaaaa")).not.toBe(
      createTokenId("aaaaaaaaaaaaaaaaaaaaaaab"),
    );
  });

  it("should not contain the token", () => {
    const token = "OurklwV5XsDJTIE1NJaD2wtt";

    expect(createTokenId(token)).not.toContain(token);
    expect(createTokenId(token).length).toBeLessThan(token.length);
  });

  it("should handle an empty token", () => {
    expect(typeof createTokenId("")).toBe("string");
  });
});
