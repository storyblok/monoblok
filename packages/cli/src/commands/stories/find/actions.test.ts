import { describe, expect, it } from "vitest";
import { assertSupportedOptions, buildQueryParams } from "./actions";
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
            capiParams: "{language: de}",
          }),
        ),
      ).not.toThrow();
    });

    // A story with no published content is undecidable on the CDN, so it passes
    // through and gets matched against its draft — a "what is live" run that
    // reports stories which have never been live.
    it("should reject a published --capi-params version without --publish-status published", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            capiFilter: true,
            where: ["$.content"],
            capiParams: "{version: published}",
          }),
        ),
      ).toThrow(/needs --publish-status published/);
    });

    it("should accept a published --capi-params version alongside --publish-status published", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            capiFilter: true,
            where: ["$.content"],
            capiParams: "{version: published}",
            publishStatus: "published",
          }),
        ),
      ).not.toThrow();
    });

    it("should accept an explicit draft --capi-params version, which matches what MAPI serves", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            capiFilter: true,
            where: ["$.content"],
            capiParams: "{version: draft}",
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

describe("buildQueryParams", () => {
  it("should turn --container-block into a component clause", () => {
    expect(
      buildQueryParams(undefined, options({ containerBlock: "product" })).filter_query,
    ).toEqual({ component: { in: "product" } });
  });

  // Regression: `--container-block` was spread over the parsed `--query` into
  // one object, so a `component` clause in the query vanished without a word.
  it("should reject --container-block conflicting with a component clause in --query", () => {
    expect(() =>
      buildQueryParams(
        undefined,
        options({ query: "[component][in]=hero", containerBlock: "product" }),
      ),
    ).toThrow(/Conflicting filters for "component"/);
  });

  it("should keep --query clauses on other fields alongside --container-block", () => {
    expect(
      buildQueryParams(
        undefined,
        options({ query: "[highlighted][in]=true", containerBlock: "product" }),
      ).filter_query,
    ).toEqual({
      highlighted: { in: "true" },
      component: { in: "product" },
    });
  });

  // MAPI returns `content_summary: {}` unless asked, and under --skip-content
  // the listing is the entire answer the user gets.
  it("should request the content summary when the content fetch is skipped", () => {
    expect(buildQueryParams(undefined, options({ skipContent: true })).with_summary).toBe(true);
    expect(buildQueryParams(undefined, options()).with_summary).toBeUndefined();
  });
});
