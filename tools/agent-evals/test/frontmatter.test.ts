import { describe, expect, it } from "vitest";
import { stripRoutingFrontmatter } from "../src/frontmatter.ts";

describe("stripRoutingFrontmatter", () => {
  it("removes model and effort and keeps everything else", () => {
    const input = [
      "---",
      "name: plan",
      "description:",
      "  Use when asked to plan",
      "model: sonnet",
      "effort: high",
      "context: fork",
      "---",
      "",
      "# Plan",
      "model: this line is body text",
    ].join("\n");
    expect(stripRoutingFrontmatter(input)).toBe(
      [
        "---",
        "name: plan",
        "description:",
        "  Use when asked to plan",
        "context: fork",
        "---",
        "",
        "# Plan",
        "model: this line is body text",
      ].join("\n"),
    );
  });

  it("returns files without frontmatter unchanged", () => {
    expect(stripRoutingFrontmatter("# Title\nmodel: x\n")).toBe("# Title\nmodel: x\n");
  });
});
