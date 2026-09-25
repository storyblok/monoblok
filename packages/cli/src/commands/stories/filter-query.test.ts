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

  // Each of these would put no filter on the wire, so the command would return
  // the whole scope at exit 0 as if it had answered the question asked.
  it.each(["", "   ", "&", "&&", "{}"])("should reject input with no clauses: %j", (input) => {
    expect(() => parseFilterQuery(input)).toThrow(CommandError);
  });

  it("should reject an operation the API does not know", () => {
    expect(() => parseFilterQuery("[category][eq]=technology")).toThrow(
      /Unknown --query operation: \[category\]\[eq\]/,
    );
    expect(() => parseFilterQuery('{"category":{"bogusop":"x"}}')).toThrow(CommandError);
  });

  it("should accept every operation the API applies", () => {
    expect(
      parseFilterQuery("[a][not_in]=x&[b][like]=y*&[c][gt-date]=2024-01-01&[d][all_in_array]=z"),
    ).toEqual({
      a: { not_in: "x" },
      b: { like: "y*" },
      c: { "gt-date": "2024-01-01" },
      d: { all_in_array: "z" },
    });
  });

  it("should reject JSON whose field is not an object of operations", () => {
    expect(() => parseFilterQuery('{"component":"hero"}')).toThrow(/object of operations/);
  });

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
    expect(mergeFilterQuery({ priority: { gt_int: 1 } }, { priority: { lt_int: 5 } })).toEqual({
      priority: { gt_int: 1, lt_int: 5 },
    });
  });

  // A filter the user asked for must never be dropped by another one.
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
