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

    it("is accepted with --where, which the story listing can still answer", () => {
      expect(() =>
        assertSupportedOptions(
          options({ skipContent: true, where: ["$[?search($.full_slug, 'blog')]"] }),
        ),
      ).not.toThrow();
    });

    it("is accepted with a --where that reads content, which warns on an empty result instead", () => {
      expect(() =>
        assertSupportedOptions(
          options({ skipContent: true, where: ["$..[?(@.component == 'hero')]"] }),
        ),
      ).not.toThrow();
    });

    it("is rejected with --check-references", () => {
      expect(() =>
        assertSupportedOptions(options({ skipContent: true, checkReferences: true })),
      ).toThrow(/--skip-content cannot be combined with --check-references/);
    });

    it("is accepted with --capi-filter, which reads content in bulk to decide matches", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            skipContent: true,
            capiFilter: true,
            where: ["$..[?(@.component == 'hero')]"],
          }),
        ),
      ).not.toThrow();
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

    it("does not require --where under --check-references, which prunes nothing", () => {
      expect(() =>
        assertSupportedOptions(options({ capiFilter: true, checkReferences: true })),
      ).not.toThrow();
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
