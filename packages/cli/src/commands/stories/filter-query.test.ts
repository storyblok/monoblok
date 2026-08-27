import { describe, expect, it } from "vitest";
import { mergeFilterQuery, parseFilterQuery } from "./filter-query";
import { CommandError } from "../../utils/error/command-error";

describe("parseFilterQuery", () => {
  it("should parse a single bracket clause into a nested object", () => {
    expect(parseFilterQuery("[highlighted][in]=true")).toEqual({
      highlighted: { in: "true" },
    });
  });

  it("should parse multiple bracket clauses joined with &", () => {
    expect(parseFilterQuery("[highlighted][in]=true&[component][in]=hero")).toEqual({
      highlighted: { in: "true" },
      component: { in: "hero" },
    });
  });

  it("should merge multiple operations on the same field", () => {
    expect(parseFilterQuery("[priority][gt_int]=1&[priority][lt_int]=5")).toEqual({
      priority: { gt_int: "1", lt_int: "5" },
    });
  });

  it("should parse a JSON object string", () => {
    expect(parseFilterQuery('{"component":{"in":"hero"}}')).toEqual({
      component: { in: "hero" },
    });
  });

  it("should return an empty object for empty input", () => {
    expect(parseFilterQuery("")).toEqual({});
    expect(parseFilterQuery("   ")).toEqual({});
  });

  // Regression: these used to be skipped silently, so the whole `--query` could
  // parse to `{}` — no filter on the wire, and a full-space result set returned
  // at exit 0 as if it had answered the question asked.
  it("should reject a clause with no operation", () => {
    expect(() => parseFilterQuery("[highlighted]=true")).toThrow(CommandError);
  });

  it("should reject input that is not a query at all", () => {
    expect(() => parseFilterQuery("not-a-query")).toThrow(/Invalid --query clause/);
  });

  it("should name every unreadable clause, keeping the readable ones out of the message", () => {
    expect(() => parseFilterQuery("[component][in]=hero&nonsense&[a]=1")).toThrow(
      /nonsense, \[a\]=1/,
    );
  });

  it("should report malformed JSON against the flag it came from", () => {
    expect(() => parseFilterQuery('{"a":')).toThrow(/Invalid --query JSON/);
  });

  it("should reject JSON that is not an object", () => {
    expect(() => parseFilterQuery("[1,2]")).toThrow(CommandError);
  });
});

describe("mergeFilterQuery", () => {
  it("should combine clauses that touch different fields", () => {
    expect(
      mergeFilterQuery({ highlighted: { in: "true" } }, { component: { in: "hero" } }),
    ).toEqual({
      highlighted: { in: "true" },
      component: { in: "hero" },
    });
  });

  it("should combine different operations on the same field", () => {
    expect(mergeFilterQuery({ priority: { gt_int: "1" } }, { priority: { lt_int: "5" } })).toEqual({
      priority: { gt_int: "1", lt_int: "5" },
    });
  });

  // Regression: a plain object spread let the second value win in silence, so
  // `--query "[component][in]=hero" --container-block product` dropped `hero`.
  it("should reject the same field and operation coming from both sides", () => {
    expect(() =>
      mergeFilterQuery({ component: { in: "hero" } }, { component: { in: "product" } }),
    ).toThrow(/Conflicting filters for "component"/);
  });

  it("should return the other side unchanged when one is empty", () => {
    expect(mergeFilterQuery({}, { component: { in: "hero" } })).toEqual({
      component: { in: "hero" },
    });
    expect(mergeFilterQuery({ component: { in: "hero" } }, {})).toEqual({
      component: { in: "hero" },
    });
  });
});
