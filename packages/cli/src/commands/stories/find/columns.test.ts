import { describe, expect, it } from "vitest";
import { summarizeIssues } from "./columns";
import type { RefIssue } from "./references";

const issue = (type: RefIssue["type"]): RefIssue => ({
  type,
  ref_type: "multilink",
  target_uuid: "target-uuid",
  field_path: "content.link",
});

describe("summarizeIssues", () => {
  it("should summarize issues in the same type order whatever order they were found in", () => {
    expect(summarizeIssues([issue("stale_url"), issue("broken"), issue("broken")])).toBe(
      "2 broken, 1 stale_url",
    );
    expect(summarizeIssues([issue("broken"), issue("stale_url"), issue("broken")])).toBe(
      "2 broken, 1 stale_url",
    );
  });
});
