import { describe, expect, it } from "vitest";
import { formatSpaceNotAllowedMessage } from "../../utils";
import { assertSpaceAllowed } from "./space-guard";

describe("assertSpaceAllowed", () => {
  it("should pass when the space is in the grant", () => {
    expect(() => assertSpaceAllowed(123, [{ id: 123 }])).not.toThrow();
  });

  it("should reject a space outside the grant using the shared wording", () => {
    expect(() => assertSpaceAllowed(999, [{ id: 1 }, { id: 2 }])).toThrow(
      formatSpaceNotAllowedMessage(999, [1, 2]),
    );
  });

  it("should pass when the grant has no space restriction", () => {
    expect(() => assertSpaceAllowed(999, [])).not.toThrow();
    expect(() => assertSpaceAllowed(999, undefined)).not.toThrow();
  });

  it("should pass when no space is targeted", () => {
    expect(() => assertSpaceAllowed(undefined, [{ id: 123 }])).not.toThrow();
  });
});
