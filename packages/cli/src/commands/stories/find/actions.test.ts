import { describe, expect, it } from "vitest";
import {
  assertSupportedOptions,
  buildQueryParams,
  buildWhereFilters,
  parseIssueTypes,
  parseLimit,
  parseSort,
  parseWorkflowStages,
} from "./actions";
import type { Story } from "../constants";
import { CommandError } from "../../../utils/error/command-error";
import type { FindOptions } from "./types";

const options = (overrides: Partial<FindOptions> = {}): FindOptions => ({
  entryType: "all",
  where: [],
  ...overrides,
});

describe("assertSupportedOptions", () => {
  it("accepts the default option set", () => {
    expect(() => assertSupportedOptions(options())).not.toThrow();
  });

  describe("--references", () => {
    const UUID = "0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0e";
    const OTHER = "7a2b3c4d-1e2f-4a5b-9c8d-0e1f2a3b4c5d";

    it("should accept a single UUID", () => {
      expect(() => assertSupportedOptions(options({ references: UUID }))).not.toThrow();
    });

    it("should accept several UUIDs separated by commas", () => {
      expect(() =>
        assertSupportedOptions(options({ references: `${UUID},${OTHER}` })),
      ).not.toThrow();
    });

    // The API would take this as a substring scan of raw story content: slow,
    // and a different question than the one the flag asks.
    it("should reject a value that is not a UUID", () => {
      expect(() => assertSupportedOptions(options({ references: "hero" }))).toThrow(CommandError);
    });

    it("should reject a UUID with a digit missing", () => {
      expect(() =>
        assertSupportedOptions(options({ references: "0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0" })),
      ).toThrow(CommandError);
    });

    // Nil and the v2 range are outside what the API matches, so accepting them
    // here would hand the user a silent fallback instead of an error.
    it("should reject a UUID whose version the API does not issue", () => {
      expect(() =>
        assertSupportedOptions(options({ references: "00000000-0000-0000-0000-000000000000" })),
      ).toThrow(CommandError);
    });

    it("should reject an empty value", () => {
      expect(() => assertSupportedOptions(options({ references: "" }))).toThrow(CommandError);
    });
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

    // A changed story is live: it has published content, and that content is
    // exactly what the CDN can decide it on. Refusing it would push a "what is
    // live" run into a filter that drops every live story with pending edits.
    it("should accept a published --capi-params version alongside --publish-status changed", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            capiFilter: true,
            where: ["$.content"],
            capiParams: "{version: published}",
            publishStatus: "changed",
          }),
        ),
      ).not.toThrow();
    });

    it("should reject a published --capi-params version alongside --publish-status draft", () => {
      expect(() =>
        assertSupportedOptions(
          options({
            capiFilter: true,
            where: ["$.content"],
            capiParams: "{version: published}",
            publishStatus: "draft",
          }),
        ),
      ).toThrow(/needs --publish-status published or --publish-status changed/);
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

  // CDN content has no `__i18n__` keys, so pruning on one would empty the result.
  it("should reject a --where on a field-level translation under --capi-filter", () => {
    expect(() =>
      assertSupportedOptions(
        options({ capiFilter: true, where: ["$[?($.content.title__i18n__de)]"] }),
      ),
    ).toThrow(/field-level translations/);
  });

  it("should allow a --where on a field-level translation without --capi-filter", () => {
    expect(() =>
      assertSupportedOptions(options({ where: ["$[?($.content.title__i18n__de)]"] })),
    ).not.toThrow();
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

  // Both write `component`; neither may silently replace the other.
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

describe("the server-side scope filters", () => {
  it("should pass --tag through as a tag list", () => {
    expect(buildQueryParams(undefined, options({ tag: "campaign,legacy" })).with_tag).toBe(
      "campaign,legacy",
    );
  });

  it("should pass --workflow-stage through as a stage list", () => {
    expect(
      buildQueryParams(undefined, options({ workflowStage: "42, 43" })).in_workflow_stages,
    ).toBe("42,43");
  });

  it("should pass --sort through, since the API owns which columns sort", () => {
    expect(buildQueryParams(undefined, options({ sort: "updated_at:desc" })).sort_by).toBe(
      "updated_at:desc",
    );
  });

  it("should leave all three out when the flags are absent", () => {
    const params = buildQueryParams(undefined, options());
    expect(params.with_tag).toBeUndefined();
    expect(params.in_workflow_stages).toBeUndefined();
    expect(params.sort_by).toBeUndefined();
  });
});

describe("parseLimit", () => {
  it("should read a positive whole number", () => {
    expect(parseLimit("5")).toBe(5);
  });

  it("should be absent when the flag was not passed", () => {
    expect(parseLimit(undefined)).toBeUndefined();
  });

  // A run that stopped at the first line would otherwise look like a search
  // that matched almost nothing.
  it.each(["0", "-1", "abc", "1.5", ""])("should reject %o", (raw) => {
    expect(() => parseLimit(raw)).toThrow(CommandError);
  });
});

describe("parseSort", () => {
  it.each([
    "updated_at",
    "updated_at:desc",
    "content.price:asc:int",
    "name:ASC:nulls_last",
    "a:asc,b:desc",
  ])("should accept %o", (raw) => {
    expect(parseSort(raw)).toBe(raw);
  });

  // The API sorts ascending on a direction it does not know, so these would
  // silently return the wrong order.
  it.each(["updated_at:des", "updated_at:down", ":asc", "content.price:asc:string"])(
    "should reject %o",
    (raw) => {
      expect(() => parseSort(raw)).toThrow(/Invalid --sort value/);
    },
  );
});

describe("parseWorkflowStages", () => {
  // A stage name matches no story, which reads as a genuine empty answer.
  it.each(["abc", "42,review", "", "4.2"])("should reject %o", (raw) => {
    expect(() => parseWorkflowStages(raw)).toThrow(CommandError);
  });
});

describe("parseIssueTypes", () => {
  it("should report every type for the bare flag", () => {
    expect(parseIssueTypes(true)).toEqual(new Set(["broken", "unpublished", "stale_url"]));
  });

  it("should narrow to the listed types", () => {
    expect(parseIssueTypes("broken, stale_url")).toEqual(new Set(["broken", "stale_url"]));
  });

  it("should reject an unknown type", () => {
    expect(() => parseIssueTypes("broken,missing")).toThrow(/got: missing/);
  });

  it("should be absent when the flag was not passed", () => {
    expect(parseIssueTypes(undefined)).toBeUndefined();
  });
});

describe("buildWhereFilters", () => {
  // `--skip-content` asks for `content_summary`, a truncated copy of the root
  // fields; a content filter must not match on that partial copy.
  it("should not match on the listing's content_summary", () => {
    const [matchesHero] = buildWhereFilters(["$..[?(@.component == 'hero')]"]);
    const listed = { id: 1, content_summary: { component: "hero" } } as unknown as Story;

    expect(matchesHero(listed)).toBe(false);
  });

  it("should still match on story metadata", () => {
    const [matchesSlug] = buildWhereFilters(["$[?(@ == 'blog/post')]"]);
    const listed = { id: 1, full_slug: "blog/post", content_summary: {} } as unknown as Story;

    expect(matchesSlug(listed)).toBe(true);
  });
});
