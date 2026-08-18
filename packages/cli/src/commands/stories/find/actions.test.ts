import { describe, expect, it } from "vitest";
import { assertSupportedOptions } from "./actions";
import { CommandError } from "../../../utils/error/command-error";
import type { FindOptions } from "./types";

const options = (overrides: Partial<FindOptions> = {}): FindOptions => ({
  searchMode: "fulltext",
  entryType: "all",
  where: [],
  ...overrides,
});

describe("assertSupportedOptions", () => {
  it("accepts the default option set", () => {
    expect(() => assertSupportedOptions(options())).not.toThrow();
  });

  it("rejects a search mode that is not implemented", () => {
    expect(() => assertSupportedOptions(options({ searchMode: "semantic" }))).toThrow(CommandError);
  });

  describe("--skip-content", () => {
    it("is accepted on its own", () => {
      expect(() => assertSupportedOptions(options({ skipContent: true }))).not.toThrow();
    });

    it("is rejected with --where, which needs the content it skips", () => {
      expect(() =>
        assertSupportedOptions(options({ skipContent: true, where: ["$.content"] })),
      ).toThrow(/--skip-content cannot be combined with --where/);
    });

    it("is rejected with --check-references", () => {
      expect(() =>
        assertSupportedOptions(options({ skipContent: true, checkReferences: true })),
      ).toThrow(/--skip-content cannot be combined with --check-references/);
    });

    it("is rejected with --capi-filter, which exists to fetch content in bulk", () => {
      expect(() =>
        assertSupportedOptions(options({ skipContent: true, capiFilter: true })),
      ).toThrow(/--skip-content cannot be combined with --capi-filter/);
    });
  });

  describe("--capi-filter", () => {
    it("is accepted with a --where filter to prune with", () => {
      expect(() =>
        assertSupportedOptions(options({ capiFilter: true, where: ["$.content"] })),
      ).not.toThrow();
    });

    it("is rejected without --where, having nothing to prune", () => {
      expect(() => assertSupportedOptions(options({ capiFilter: true }))).toThrow(
        /--capi-filter needs at least one --where filter/,
      );
    });

    it("is rejected with --check-references, which reads every story's content", () => {
      expect(() =>
        assertSupportedOptions(
          options({ capiFilter: true, checkReferences: true, where: ["$._ref_issues"] }),
        ),
      ).toThrow(/--capi-filter cannot be combined with --check-references/);
    });

    it("validates --capi-params as a usage error", () => {
      expect(() =>
        assertSupportedOptions(
          options({ capiFilter: true, where: ["$.content"], capiParams: "per_page=100" }),
        ),
      ).toThrow(CommandError);
    });

    it("accepts a well-formed --capi-params", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            capiFilter: true,
            where: ["$.content"],
            capiParams: "{version: published}",
          }),
        ),
      ).not.toThrow();
    });
  });

  it("rejects --capi-params without --capi-filter, where it would do nothing", () => {
    expect(() => assertSupportedOptions(options({ capiParams: "version=published" }))).toThrow(
      /--capi-params has no effect without --capi-filter/,
    );
  });
});
