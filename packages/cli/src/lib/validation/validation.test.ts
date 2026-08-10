import { describe, expect, it } from "vitest";

import type { ValidationIssue } from "./adapter";
import type { ValidationRunResult } from "./types";
import { parseFormat, parseLevel } from "./types";
import { countIssues, filterIssuesByLevel } from "./filter";
import { formatJson } from "./format-json";
import { formatPretty } from "./format-pretty";
import { entityToHeader, entityToRef, groupIssuesByEntity } from "./group";
import { writeValidationReport } from "./report";
import type { Reporter } from "../reporter/reporter";

const error: ValidationIssue = {
  severity: "error",
  code: "unresolved_allow",
  path: ["blocks", "hero", "body", "allow"],
  entity: "block:hero",
  message: 'Field "body" allows unknown block "gallery".',
};

const warning: ValidationIssue = {
  severity: "warning",
  code: "unknown_field",
  path: ["content", "legacy_cta"],
  entity: "block:hero",
  message: 'Unknown field "legacy_cta" on component "hero".',
};

const heroRef = { kind: "block", name: "hero" } as const;

describe("filterIssuesByLevel", () => {
  it("should pass through everything at the warning threshold", () => {
    expect(filterIssuesByLevel([error, warning], "warning")).toHaveLength(2);
  });

  it("should drop warnings at the error threshold", () => {
    expect(filterIssuesByLevel([error, warning], "error")).toEqual([error]);
  });
});

describe("entityToHeader", () => {
  it('should format typed entities as "name (type)"', () => {
    expect(entityToHeader("block:hero")).toBe("hero (block)");
    expect(entityToHeader("datasource:colors")).toBe("colors (datasource)");
  });

  it("should leave bare entities untouched", () => {
    expect(entityToHeader("schema")).toBe("schema");
  });

  it("should not render a blank header for an entity with no name", () => {
    expect(entityToHeader("block:")).toBe("<unnamed block>");
  });
});

describe("entityToRef", () => {
  it("should carry the type and name a consumer would otherwise parse out of the header", () => {
    expect(entityToRef("block:hero")).toEqual({ kind: "block", name: "hero" });
    expect(entityToRef("datasource:colors")).toEqual({ kind: "datasource", name: "colors" });
  });

  it("should not guess a type for an entity the validators do not attribute", () => {
    expect(entityToRef("schema")).toEqual({ kind: "schema" });
    expect(entityToRef("story")).toEqual({ kind: "schema" });
  });
});

describe("groupIssuesByEntity", () => {
  it("should group issues by entity in first-seen order", () => {
    const other: ValidationIssue = { ...error, entity: "block:page" };
    const groups = groupIssuesByEntity([error, other, warning]);
    expect(groups.map((g) => g.header)).toEqual(["hero (block)", "page (block)"]);
    expect(groups[0].issues).toHaveLength(2);
  });

  it("should attach a machine-readable ref to every group", () => {
    expect(groupIssuesByEntity([error])[0].ref).toEqual({ kind: "block", name: "hero" });
  });
});

describe("countIssues", () => {
  it("should count errors, warnings, and units with issues", () => {
    const result: ValidationRunResult = {
      unitNoun: "entities",
      unitNounSingular: "entity",
      unitsTotal: 14,
      groups: [{ header: "hero (block)", ref: heroRef, issues: [error, warning] }],
    };
    expect(countIssues(result)).toEqual({ errors: 1, warnings: 1, unitsWithIssues: 1 });
  });

  // Regression: `validateSchema` attributes every nameless block to the single
  // `schema` pseudo-entity, so counting groups reported two broken blocks as one
  // affected unit — and `unitsTotal - unitsWithIssues` then counted one of them
  // as clean.
  it("should count each definition in the schema pseudo-group as its own unit", () => {
    const namelessBlock = (index: number): ValidationIssue => ({
      severity: "error",
      code: "invalid_block_name",
      path: ["blocks", index],
      entity: "schema",
      message: `Block at index ${index} is missing a non-empty string "name".`,
    });
    const result: ValidationRunResult = {
      unitNoun: "entities",
      unitNounSingular: "entity",
      unitsTotal: 3,
      groups: [
        {
          header: "schema",
          ref: { kind: "schema" },
          issues: [namelessBlock(0), namelessBlock(1)],
        },
      ],
    };
    expect(countIssues(result)).toMatchObject({ unitsWithIssues: 2 });
  });

  it("should count two issues on the same definition as one unit", () => {
    const at = (code: string): ValidationIssue => ({
      severity: "error",
      code,
      path: ["blocks", 0],
      entity: "schema",
      message: "Broken block.",
    });
    const result: ValidationRunResult = {
      unitNoun: "entities",
      unitNounSingular: "entity",
      unitsTotal: 3,
      groups: [
        {
          header: "schema",
          ref: { kind: "schema" },
          issues: [at("invalid_block_name"), at("missing_field_name")],
        },
      ],
    };
    expect(countIssues(result)).toMatchObject({ unitsWithIssues: 1 });
  });

  // A story's `entity` is the offending block, so counting by entity instead of
  // by group would collapse every story that shares one.
  it("should count one unit per story even when they share a block", () => {
    const result: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 5,
      groups: [
        { header: "a (story #1)", ref: { kind: "story", id: 1, slug: "a" }, issues: [error] },
        { header: "b (story #2)", ref: { kind: "story", id: 2, slug: "b" }, issues: [error] },
      ],
    };
    expect(countIssues(result)).toMatchObject({ unitsWithIssues: 2 });
  });
});

describe("formatPretty unit noun", () => {
  const oneUnit = (unitsTotal: number): ValidationRunResult => ({
    unitNoun: "stories",
    unitNounSingular: "story",
    unitsTotal,
    groups: [
      { header: "home (story #1)", ref: { kind: "story", id: 1, slug: "home" }, issues: [error] },
    ],
  });

  // Errors and warnings were pluralized while the unit noun was not, so a
  // single-unit run read `1 error, 0 warnings across 1 of 1 stories`.
  it("should use the singular noun for a run over one unit", () => {
    expect(formatPretty(oneUnit(1), "warning")).toContain("across 1 of 1 story");
  });

  it("should use the plural noun for any other total", () => {
    expect(formatPretty(oneUnit(4), "warning")).toContain("across 1 of 4 stories");
    expect(formatPretty(oneUnit(0), "warning")).toContain("across 1 of 0 stories");
  });
});

describe("writeValidationReport", () => {
  /** Captures what the reporter was handed, without touching the filesystem. */
  function fakeReporter() {
    const summaries: Record<string, unknown> = {};
    const metas: Record<string, unknown> = {};
    const reporter = {
      addSummary(key: string, value: unknown) {
        summaries[key] = value;
        return reporter;
      },
      addMeta(key: string, value: unknown) {
        metas[key] = value;
        return reporter;
      },
    };
    return { reporter, summaries, metas };
  }

  // The artifact's `succeeded` is derived, so a wrong unit count silently
  // reported a broken definition as clean.
  it("should keep succeeded + failed equal to the unit total", () => {
    const { reporter, summaries } = fakeReporter();
    const namelessBlock = (index: number): ValidationIssue => ({
      severity: "error",
      code: "invalid_block_name",
      path: ["blocks", index],
      entity: "schema",
      message: "Nameless block.",
    });
    const result: ValidationRunResult = {
      unitNoun: "entities",
      unitNounSingular: "entity",
      unitsTotal: 3,
      groups: [
        {
          header: "schema",
          ref: { kind: "schema" },
          issues: [namelessBlock(0), namelessBlock(1)],
        },
      ],
    };

    writeValidationReport(reporter as unknown as Reporter, result);

    expect(summaries.validation).toEqual({ total: 3, succeeded: 1, failed: 2 });
  });
});

describe("formatPretty", () => {
  const result: ValidationRunResult = {
    unitNoun: "entities",
    unitNounSingular: "entity",
    unitsTotal: 14,
    groups: [{ header: "hero (block)", ref: heroRef, issues: [error, warning] }],
  };

  it("should render group headers, issue lines, and a true-total summary", () => {
    const output = formatPretty(result, "warning");
    expect(output).toContain("hero (block)");
    expect(output).toContain("unresolved_allow");
    expect(output).toContain(
      'blocks.hero.body.allow: Field "body" allows unknown block "gallery".',
    );
    expect(output).toContain("unknown_field");
    expect(output).toContain("1 error, 1 warning across 1 of 14 entities");
  });

  it("should hide warnings at the error threshold but keep true totals in the summary", () => {
    const output = formatPretty(result, "error");
    expect(output).not.toContain("unknown_field");
    expect(output).toContain("1 error, 1 warning across 1 of 14 entities");
  });

  // Counting warnings that were never printed reads as a contradiction, so the
  // summary has to say the threshold withheld them.
  it("should say how many warnings the error threshold withheld", () => {
    expect(formatPretty(result, "error")).toContain("(1 warning hidden by --level error)");
  });

  it("should not mention hidden warnings when there are none to hide", () => {
    expect(formatPretty(result, "warning")).not.toContain("hidden by");
    const errorsOnly: ValidationRunResult = {
      unitNoun: "entities",
      unitNounSingular: "entity",
      unitsTotal: 14,
      groups: [{ header: "hero (block)", ref: heroRef, issues: [error] }],
    };
    expect(formatPretty(errorsOnly, "error")).not.toContain("hidden by");
  });

  it("should report a clean run", () => {
    const clean: ValidationRunResult = { unitNoun: "entities", unitsTotal: 14, groups: [] };
    expect(formatPretty(clean, "warning")).toContain(
      "0 errors, 0 warnings across 0 of 14 entities",
    );
  });
});

describe("parseLevel / parseFormat", () => {
  it("should accept the documented values", () => {
    expect(parseLevel("error")).toBe("error");
    expect(parseLevel("warning")).toBe("warning");
    expect(parseFormat("pretty")).toBe("pretty");
    expect(parseFormat("json")).toBe("json");
  });

  it("should throw a CommandError so a bad value exits 2, not commander's 1", () => {
    expect(() => parseLevel("bogus")).toThrow(/Invalid --level "bogus"/);
    expect(() => parseFormat("yaml")).toThrow(/Invalid --format "yaml"/);
  });
});

describe("formatJson", () => {
  const result: ValidationRunResult = {
    unitNoun: "entities",
    unitNounSingular: "entity",
    unitsTotal: 14,
    groups: [{ header: "hero (block)", ref: heroRef, issues: [error, warning] }],
  };

  it("should emit parseable JSON with true totals and ok:false on errors", () => {
    const report = JSON.parse(formatJson(result, "warning"));
    expect(report).toMatchObject({
      ok: false,
      unit: "entities",
      unitsTotal: 14,
      unitsWithIssues: 1,
      errors: 1,
      warnings: 1,
      fetchFailures: 0,
      listFailed: false,
    });
    expect(report.groups[0].issues).toHaveLength(2);
  });

  it("should apply the level filter to groups but keep true totals", () => {
    const report = JSON.parse(formatJson(result, "error"));
    expect(report.groups[0].issues.map((issue: ValidationIssue) => issue.code)).toEqual([
      "unresolved_allow",
    ]);
    expect(report).toMatchObject({ errors: 1, warnings: 1 });
  });

  it("should drop groups left empty by the level filter", () => {
    const warningsOnly: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 3,
      groups: [
        {
          header: "home (story #1)",
          ref: { kind: "story", id: 1, slug: "home" },
          issues: [warning],
        },
      ],
    };
    const report = JSON.parse(formatJson(warningsOnly, "error"));
    expect(report.groups).toEqual([]);
    // Warnings alone keep the run ok.
    expect(report.ok).toBe(true);
  });

  it("should report ok:false for a clean run that failed to list", () => {
    const incomplete: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 0,
      groups: [],
      listFailed: true,
    };
    expect(JSON.parse(formatJson(incomplete, "warning"))).toMatchObject({
      ok: false,
      listFailed: true,
    });
  });

  it("should report ok:false for a clean run with unfetched stories", () => {
    const incomplete: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 5,
      groups: [],
      fetchFailures: 2,
    };
    expect(JSON.parse(formatJson(incomplete, "warning"))).toMatchObject({
      ok: false,
      fetchFailures: 2,
    });
  });

  // A JSON consumer never sees stderr, so an incomplete run has to carry its
  // reason in the document.
  it("should carry the reason a listing failed", () => {
    const incomplete: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 0,
      groups: [],
      listFailed: true,
      listError: "The requested resource was not found",
    };
    expect(JSON.parse(formatJson(incomplete, "warning")).listError).toBe(
      "The requested resource was not found",
    );
  });

  it("should carry the reason each unit could not be fetched", () => {
    const incomplete: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 2,
      groups: [],
      fetchFailures: 1,
      fetchErrors: [{ id: 42, slug: "home", message: "Internal Server Error" }],
    };
    expect(JSON.parse(formatJson(incomplete, "warning")).fetchErrors).toEqual([
      { id: 42, slug: "home", message: "Internal Server Error" },
    ]);
  });

  it("should omit the failure reasons when nothing failed", () => {
    const clean: ValidationRunResult = {
      unitNoun: "stories",
      unitsTotal: 5,
      groups: [],
      fetchErrors: [],
    };
    const report = JSON.parse(formatJson(clean, "warning"));
    expect(report).not.toHaveProperty("fetchErrors");
    expect(report).not.toHaveProperty("listError");
  });

  // A prefix that selects nothing otherwise produces the same document as a
  // clean run over real content, so a consumer cannot tell them apart.
  it("should echo the filter that narrowed the population", () => {
    const filtered: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 3,
      groups: [],
      filter: { option: "--starts-with", value: "en/" },
    };
    expect(JSON.parse(formatJson(filtered, "warning"))).toMatchObject({
      filter: { option: "--starts-with", value: "en/" },
    });
  });

  it("should flag a filter that matched nothing", () => {
    const empty: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 0,
      groups: [],
      filter: { option: "--starts-with", value: "nope/" },
    };
    expect(JSON.parse(formatJson(empty, "warning"))).toMatchObject({
      noMatches: true,
      unitsTotal: 0,
    });
  });

  it("should not flag no-matches when the filter did select stories", () => {
    const filtered: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 3,
      groups: [],
      filter: { option: "--starts-with", value: "en/" },
    };
    expect(JSON.parse(formatJson(filtered, "warning"))).not.toHaveProperty("noMatches");
  });

  it("should not flag no-matches for an unfiltered run over an empty space", () => {
    const empty: ValidationRunResult = { unitNoun: "stories", unitsTotal: 0, groups: [] };
    const report = JSON.parse(formatJson(empty, "warning"));
    expect(report).not.toHaveProperty("noMatches");
    expect(report).not.toHaveProperty("filter");
  });

  it("should leave a failed listing to explain its own empty population", () => {
    // `listFailed` already says why nothing was validated; `noMatches` would
    // blame the filter for a failure it did not cause.
    const failed: ValidationRunResult = {
      unitNoun: "stories",
      unitNounSingular: "story",
      unitsTotal: 0,
      groups: [],
      filter: { option: "--starts-with", value: "en/" },
      listFailed: true,
    };
    expect(JSON.parse(formatJson(failed, "warning"))).not.toHaveProperty("noMatches");
  });

  it("should carry each group's identity so a consumer never parses the header", () => {
    const report = JSON.parse(formatJson(result, "warning"));
    expect(report.groups[0].ref).toEqual({ kind: "block", name: "hero" });
  });

  it("should report ok:true for a complete clean run", () => {
    const clean: ValidationRunResult = {
      unitNoun: "stories",
      unitsTotal: 5,
      groups: [],
      fetchFailures: 0,
    };
    expect(JSON.parse(formatJson(clean, "warning"))).toMatchObject({ ok: true });
  });
});
