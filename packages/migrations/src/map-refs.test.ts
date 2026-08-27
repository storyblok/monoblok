import { describe, expect, it } from "vitest";

import { mapRefs } from "./map-refs";

type UnknownRecord = Record<string, unknown>;

const schemas = {
  page: {
    hero_image: { type: "asset" },
    cta: { type: "multilink" },
    gallery: { type: "multiasset" },
    body: { type: "bloks" },
    tags: { type: "options", source: "internal_stories" },
    related: { type: "option", source: "internal_stories" },
    categories: { type: "options", source: "internal" },
    style: { type: "option" },
    content: { type: "richtext" },
    title: { type: "text" },
  },
  hero: {
    image: { type: "asset" },
  },
};

const makeStory = (content: Record<string, unknown>) => ({
  id: 1,
  uuid: "story-uuid",
  name: "Test Story",
  slug: "test-story",
  full_slug: "test-story",
  content: { component: "page", ...content },
  created_at: "2024-01-01T00:00:00.000Z",
  published_at: undefined,
  updated_at: "2024-01-01T00:00:00.000Z",
});

const asRecord = (value: unknown): UnknownRecord => {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
};

describe("mapRefs", () => {
  it("should remap story link ID via stories map", () => {
    const story = makeStory({
      cta: {
        fieldtype: "multilink",
        linktype: "story",
        id: 100,
        url: "",
        cached_url: "old-page",
      },
    });
    const maps = { stories: new Map([[100, 200]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    expect(asRecord(asRecord(mappedStory.content).cta).id).toBe(200);
  });

  it("should remap asset ID via assets map", () => {
    const story = makeStory({
      hero_image: { fieldtype: "asset", id: 10, filename: "old.jpg" },
    });
    const maps = { assets: new Map([[10, 20]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    expect(asRecord(asRecord(mappedStory.content).hero_image).id).toBe(20);
  });

  it("should traverse nested bloks recursively", () => {
    const story = makeStory({
      body: [
        {
          component: "hero",
          image: { fieldtype: "asset", id: 10, filename: "old.jpg" },
        },
      ],
    });
    const maps = { assets: new Map([[10, 20]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    const body = asRecord(mappedStory.content).body as unknown[];
    expect(asRecord(asRecord(body[0]).image).id).toBe(20);
  });

  it("should remap multiasset array items individually", () => {
    const story = makeStory({
      gallery: [
        { fieldtype: "asset", id: 10, filename: "a.jpg" },
        { fieldtype: "asset", id: 11, filename: "b.jpg" },
      ],
    });
    const maps = {
      assets: new Map([
        [10, 20],
        [11, 21],
      ]),
    };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    const gallery = asRecord(mappedStory.content).gallery as unknown[];
    expect(asRecord(gallery[0]).id).toBe(20);
    expect(asRecord(gallery[1]).id).toBe(21);
  });

  it("should remap i18n field variants using base field schema", () => {
    const story = makeStory({
      cta__i18n__de: {
        fieldtype: "multilink",
        linktype: "story",
        id: 100,
        url: "",
        cached_url: "old-page",
      },
    });
    const maps = { stories: new Map([[100, 200]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    expect(asRecord(asRecord(mappedStory.content).cta__i18n__de).id).toBe(200);
  });

  it("should track unknown component names in missingSchemas", () => {
    const story = makeStory({
      body: [{ component: "unknown-component", title: "test" }],
    });
    const maps = {};
    const { missingSchemas } = mapRefs(story as never, { schemas, maps });
    expect(missingSchemas.has("unknown-component")).toBe(true);
  });

  it("should leave non-story multilink fields untouched", () => {
    const story = makeStory({
      cta: {
        fieldtype: "multilink",
        linktype: "url",
        url: "https://example.com",
        cached_url: "https://example.com",
        id: "",
      },
    });
    const maps = { stories: new Map([["", 999]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    expect(asRecord(asRecord(mappedStory.content).cta).linktype).toBe("url");
    expect(asRecord(asRecord(mappedStory.content).cta).id).toBe("");
  });

  it("should remap richtext story links and richtext blok bodies", () => {
    const story = makeStory({
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Go",
                marks: [
                  {
                    type: "link",
                    attrs: { linktype: "story", uuid: "old-uuid" },
                  },
                ],
              },
            ],
          },
          {
            type: "blok",
            attrs: {
              body: [
                {
                  component: "hero",
                  image: { fieldtype: "asset", id: 10, filename: "old.jpg" },
                },
              ],
            },
          },
        ],
      },
    });
    const maps = {
      stories: new Map([["old-uuid", "new-uuid"]]),
      assets: new Map([[10, 20]]),
    };

    const { mappedStory } = mapRefs(story as never, { schemas, maps });
    const richtext = asRecord(asRecord(mappedStory.content).content);
    const richtextContent = richtext.content as unknown[];
    const paragraph = asRecord(richtextContent[0]);
    const textNode = asRecord((paragraph.content as unknown[])[0]);
    const linkMark = asRecord((textNode.marks as unknown[])[0]);
    expect(asRecord(linkMark.attrs).uuid).toBe("new-uuid");
    const blockBody = asRecord(asRecord(richtextContent[1]).attrs).body as unknown[];
    expect(asRecord(asRecord(blockBody[0]).image).id).toBe(20);
  });

  // Only `internal_stories` holds a cross-space reference. `internal` (a
  // datasource) and `self` (inline options) hold values that mean the same
  // thing in every space, so remapping them would corrupt the content.
  it("should remap story-sourced option and options fields and leave the others alone", () => {
    const story = makeStory({
      tags: [101, 102],
      related: 101,
      categories: ["electronics", "books"],
      style: "dark",
    });
    const maps = {
      stories: new Map([
        [101, 201],
        [102, 202],
      ]),
    };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });

    expect(asRecord(mappedStory.content).tags).toEqual([201, 202]);
    expect(asRecord(mappedStory.content).related).toBe(201);
    expect(asRecord(mappedStory.content).categories).toEqual(["electronics", "books"]);
    expect(asRecord(mappedStory.content).style).toBe("dark");
  });

  it("should preserve null parent_id for root-level stories", () => {
    const story = { ...makeStory({}), parent_id: null };
    const maps = { stories: new Map([[1, 99]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });

    expect(mappedStory.parent_id).toBe(null);
  });

  it("should remap parent_id when present in stories map", () => {
    const story = { ...makeStory({}), parent_id: 100 };
    const maps = { stories: new Map([[100, 200]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });

    expect(mappedStory.parent_id).toBe(200);
  });

  it("should preserve parent_id when not in stories map", () => {
    const story = { ...makeStory({}), parent_id: 999 };
    const maps = { stories: new Map([[1, 99]]) };
    const { mappedStory } = mapRefs(story as never, { schemas, maps });

    expect(mappedStory.parent_id).toBe(999);
  });
});
