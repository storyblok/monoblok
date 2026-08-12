import { beforeEach, describe, expect, it } from "vitest";
import {
  getCredentialContext,
  resetCredentialContext,
  setCredentialContext,
} from "./credential-context";

describe("credential context", () => {
  beforeEach(() => {
    resetCredentialContext();
  });

  it("should default to an unknown credential kind", () => {
    expect(getCredentialContext()).toEqual({ kind: "unknown" });
  });

  it("should return the context that was set", () => {
    setCredentialContext({ kind: "oauth", spaces: [{ id: 1, region: "eu" }], space: "1" });

    expect(getCredentialContext()).toEqual({
      kind: "oauth",
      spaces: [{ id: 1, region: "eu" }],
      space: "1",
    });
  });

  it("should replace the previous context rather than merging into it", () => {
    setCredentialContext({ kind: "oauth", spaces: [{ id: 1, region: "eu" }] });
    setCredentialContext({ kind: "pat" });

    expect(getCredentialContext()).toEqual({ kind: "pat" });
  });

  it("should reset back to unknown", () => {
    setCredentialContext({ kind: "pat" });
    resetCredentialContext();

    expect(getCredentialContext()).toEqual({ kind: "unknown" });
  });
});
