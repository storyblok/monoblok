import { describe, expect, it } from "vitest";
import { isSidecarKey } from "./contract";

describe("isSidecarKey", () => {
  it("should recognise an annotation by its prefix", () => {
    expect(isSidecarKey("_ref_issues")).toBe(true);
    expect(isSidecarKey("full_slug")).toBe(false);
  });
});
