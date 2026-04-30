import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { StoryCapi } from "../generated/stories";
import { createClient, createConfig } from "../generated/shared/client";
import { createThrottleManager } from "./rate-limit";
import {
  buildRelationMap,
  inlineStoriesContent,
  inlineStoryContent,
  parseResolveRelations,
  resolveRelationMap,
} from "./inline-relations";

let storyId = 1;

const makeStory = (
  uuid: string,
  content: StoryCapi["content"],
  overrides: Partial<StoryCapi> = {},
): StoryCapi => {
  return {
    alternates: [],
    content,
    created_at: "2024-01-01T00:00:00.000Z",
    default_full_slug: `default/${uuid}`,
    first_published_at: "2024-01-01T00:00:00.000Z",
    full_slug: `stories/${uuid}`,
    group_id: `group-${uuid}`,
    id: storyId++,
    is_startpage: false,
    lang: "default",
    name: `Story ${uuid}`,
    parent_id: 0,
    path: `stories/${uuid}`,
    position: 0,
    published_at: "2024-01-01T00:00:00.000Z",
    release_id: 0,
    slug: uuid,
    sort_by_date: "2024-01-01",
    tag_list: [],
    translated_slugs: [],
    updated_at: "2024-01-01T00:00:00.000Z",
    uuid,
    meta_data: {},
    ...overrides,
  };
};

describe("parseResolveRelations", () => {
  it("should parse resolve_relations entries", () => {
    const relationPaths = parseResolveRelations({
      resolve_relations: "page.author, page.categories, invalid-entry, page.",
    });

    expect(relationPaths).toEqual(["page.author", "page.categories"]);
  });

  it("should handle URL-encoded resolve_relations strings", () => {
    const relationPaths = parseResolveRelations({
      resolve_relations:
        "dodoNewsItem.tags%2CgooseProductMetadata.systemGenerationRef%2CgooseProductMetadata.productGroupRef",
    });

    expect(relationPaths).toEqual([
      "dodoNewsItem.tags",
      "gooseProductMetadata.systemGenerationRef",
      "gooseProductMetadata.productGroupRef",
    ]);
  });

  it("should handle URL-encoded strings with spaces", () => {
    const relationPaths = parseResolveRelations({
      resolve_relations: "page.author%2C%20page.categories",
    });

    expect(relationPaths).toEqual(["page.author", "page.categories"]);
  });

  it("should handle non-encoded strings normally", () => {
    const relationPaths = parseResolveRelations({
      resolve_relations: "page.author,page.categories",
    });

    expect(relationPaths).toEqual(["page.author", "page.categories"]);
  });
});

describe("inlineStoryContent", () => {
  it("should inline nested relations and prevent cycles", () => {
    const storyA = makeStory("story-a", {
      _uid: "a",
      component: "page",
      relation: "story-b",
    });
    const storyB = makeStory("story-b", {
      _uid: "b",
      component: "page",
      relation: "story-a",
    });

    const inlined = inlineStoryContent(
      storyA,
      ["page.relation"],
      buildRelationMap([storyB, storyA]),
    );
    const content = inlined.content;
    const inlinedB = content.relation;
    // @ts-expect-error dynamic typing
    const bContent = inlinedB?.content;

    // @ts-expect-error dynamic typing
    expect(inlinedB?.uuid).toBe("story-b");
    expect(bContent.relation?.uuid).toBe("story-a");
  });
});

describe("inlineStoriesContent", () => {
  it("should replace UUID arrays in target fields", () => {
    const tag1 = makeStory("tag-1", { _uid: "tag-1", component: "tag" });
    const tag2 = makeStory("tag-2", { _uid: "tag-2", component: "tag" });
    const page = makeStory("page-2", {
      _uid: "page-2",
      component: "page",
      related: ["tag-1", "tag-2", "missing"],
    });

    const [inlinedPage] = inlineStoriesContent(
      [page],
      ["page.related"],
      buildRelationMap([tag1, tag2]),
    );
    const content = inlinedPage.content;
    const related = content.related;

    // @ts-expect-error dynamic typing
    expect(related?.[0].uuid).toBe("tag-1");
    // @ts-expect-error dynamic typing
    expect(related?.[1].uuid).toBe("tag-2");
    // @ts-expect-error dynamic typing
    expect(related?.[2]).toBe("missing");
  });
});

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createTestClient = () =>
  createClient(
    createConfig({
      auth: "test-token",
      baseUrl: "https://api.storyblok.com",
    }),
  );

describe("resolveRelationMap", () => {
  it("should not fetch rel_uuids already present in rels", async () => {
    const requestedByUuids: string[] = [];

    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        requestedByUuids.push(url.searchParams.get("by_uuids") ?? "");
        return HttpResponse.json({ stories: [{ uuid: "missing-uuid" }] });
      }),
    );

    const rels = [makeStory("existing-uuid", { _uid: "e1", component: "author" })];

    const result = await resolveRelationMap(
      { rels, rel_uuids: ["existing-uuid", "missing-uuid"] },
      { resolve_relations: "page.author" },
      { client: createTestClient(), throttleManager: createThrottleManager(false) },
    );

    expect(result).not.toBeNull();
    // Only 'missing-uuid' should have been fetched, not 'existing-uuid'.
    expect(requestedByUuids).toEqual(["missing-uuid"]);
    expect(result!.relationMap.has("existing-uuid")).toBe(true);
    expect(result!.relationMap.has("missing-uuid")).toBe(true);
  });

  it("should skip fetch entirely when all rel_uuids are already in rels", async () => {
    const fetchSpy = vi.fn();

    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        fetchSpy();
        return HttpResponse.json({ stories: [] });
      }),
    );

    const rels = [
      makeStory("uuid-a", { _uid: "a", component: "author" }),
      makeStory("uuid-b", { _uid: "b", component: "author" }),
    ];

    await resolveRelationMap(
      { rels, rel_uuids: ["uuid-a", "uuid-b"] },
      { resolve_relations: "page.author" },
      { client: createTestClient(), throttleManager: createThrottleManager(false) },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
