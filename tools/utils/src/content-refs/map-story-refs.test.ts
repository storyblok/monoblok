import { describe, expect, it } from "vitest";
import { mapStoryRefs, type MapStoryRefsOptions } from ".";
import { asRecord, type UnknownRecord } from "../guards";

type FieldSchema = { type: string; source?: string };

const schemas = {
  page: {
    hero_image: { type: "asset" },
    cta: { type: "multilink" },
    gallery: { type: "multiasset" },
    body: { type: "bloks" },
    tags: { type: "options", source: "internal_stories" },
    related: { type: "option", source: "internal_stories" },
    categories: { type: "options", source: "internal" },
    language: { type: "option", source: "internal_languages" },
    style: { type: "option" },
    content: { type: "richtext" },
    title: { type: "text" },
  },
  hero: {
    image: { type: "asset" },
  },
} satisfies Record<string, Record<string, FieldSchema>>;

const makeStory = (content?: UnknownRecord, overrides: UnknownRecord = {}) => ({
  id: 1,
  uuid: "story-uuid",
  parent_id: null as unknown,
  alternates: undefined as unknown,
  content: content && { component: "page", ...content },
  ...overrides,
});

const swapAssetId =
  (assets: Map<number, number>) =>
  (asset: UnknownRecord, assetId: number): unknown => {
    const newId = assets.get(assetId);
    return newId === undefined ? asset : { ...asset, id: newId };
  };

const map = (
  story: ReturnType<typeof makeStory>,
  options: Partial<MapStoryRefsOptions<FieldSchema>> = {},
) => mapStoryRefs(story, { schemas, mapAsset: swapAssetId(new Map()), ...options });

const mappedContent = (
  story: ReturnType<typeof makeStory>,
  options?: Partial<MapStoryRefsOptions<FieldSchema>>,
) => asRecord(map(story, options).story.content);

describe("mapStoryRefs", () => {
  describe("story fields", () => {
    it("should remap id, uuid and parent_id", () => {
      const stories = new Map<unknown, string | number>([
        [1, 101],
        ["story-uuid", "new-uuid"],
        [5, 105],
      ]);

      const { story } = map(makeStory(undefined, { parent_id: 5 }), { stories });

      expect(story).toMatchObject({ id: 101, uuid: "new-uuid", parent_id: 105 });
    });

    it("should keep unmapped id and uuid", () => {
      const { story } = map(makeStory());

      expect(story).toMatchObject({ id: 1, uuid: "story-uuid" });
    });

    it("should remap alternate ids and parent ids", () => {
      const stories = new Map([
        [2, 102],
        [3, 103],
      ]);

      const { story } = map(makeStory(undefined, { alternates: [{ id: 2, parent_id: 3 }] }), {
        stories,
      });

      expect(story.alternates).toEqual([{ id: 102, parent_id: 103 }]);
    });

    it("should leave an unmapped parent_id untouched without a fallback", () => {
      expect(map(makeStory(undefined, { parent_id: null })).story.parent_id).toBe(null);
      expect(map(makeStory(undefined, { parent_id: 999 })).story.parent_id).toBe(999);
      expect(map(makeStory(undefined, { parent_id: "7" })).story.parent_id).toBe("7");
    });

    it("should give a root story the parent_id fallback", () => {
      const { story } = map(makeStory(undefined, { parent_id: null }), { parentIdFallback: 0 });

      expect(story.parent_id).toBe(0);
    });

    it("should coerce an unmapped parent_id to a number when a fallback is set", () => {
      const { story } = map(makeStory(undefined, { parent_id: "7" }), { parentIdFallback: 0 });

      expect(story.parent_id).toBe(7);
    });

    it("should leave content without a component untouched", () => {
      const content = { _uid: "folder" };

      expect(map(makeStory(undefined, { content })).story.content).toBe(content);
      expect(map(makeStory()).story.content).toBeUndefined();
    });
  });

  describe("content fields", () => {
    it("should remap story multilinks, including i18n variants", () => {
      const link = { linktype: "story", id: 100, cached_url: "old-page" };

      const content = mappedContent(makeStory({ cta: link, cta__i18n__de: link }), {
        stories: new Map([[100, 200]]),
      });

      expect(content.cta).toEqual({ ...link, id: 200 });
      expect(content.cta__i18n__de).toEqual({ ...link, id: 200 });
    });

    it("should leave non-story and null multilinks untouched", () => {
      const urlLink = { linktype: "url", url: "https://example.com", id: "" };

      const content = mappedContent(makeStory({ cta: urlLink, cta__i18n__de: null }), {
        stories: new Map([["", 999]]),
      });

      expect(content.cta).toEqual(urlLink);
      expect(content.cta__i18n__de).toBeNull();
    });

    it("should pass asset and multiasset items with a numeric id to the asset hook", () => {
      const content = mappedContent(
        makeStory({
          hero_image: { id: 10, filename: "a.jpg" },
          gallery: [
            { id: 11, filename: "b.jpg" },
            { id: 99, filename: "unmapped.jpg" },
          ],
        }),
        {
          mapAsset: swapAssetId(
            new Map([
              [10, 20],
              [11, 21],
            ]),
          ),
        },
      );

      expect(content.hero_image).toEqual({ id: 20, filename: "a.jpg" });
      expect(content.gallery).toEqual([
        { id: 21, filename: "b.jpg" },
        { id: 99, filename: "unmapped.jpg" },
      ]);
    });

    it("should not call the asset hook for null or id-less assets", () => {
      const mapAsset = () => {
        throw new Error("unexpected call");
      };

      const content = mappedContent(
        makeStory({ hero_image: null, gallery: [{ filename: "a.jpg" }] }),
        { mapAsset },
      );

      expect(content.hero_image).toBeNull();
      expect(content.gallery).toEqual([{ filename: "a.jpg" }]);
    });

    it("should traverse nested bloks", () => {
      const content = mappedContent(
        makeStory({ body: [{ component: "hero", image: { id: 10 } }] }),
        { mapAsset: swapAssetId(new Map([[10, 20]])) },
      );

      expect(content.body).toEqual([{ component: "hero", image: { id: 20 } }]);
    });

    it("should only remap option values sourced from stories", () => {
      const content = mappedContent(
        makeStory({
          tags: [101, 102, 103],
          related: 101,
          categories: ["electronics"],
          language: "de",
          style: "dark",
        }),
        {
          stories: new Map<unknown, string | number>([
            [101, 201],
            [102, 202],
            ["electronics", 1],
            ["de", 2],
            ["dark", 3],
          ]),
        },
      );

      expect(content).toMatchObject({
        tags: [201, 202, 103],
        related: 201,
        categories: ["electronics"],
        language: "de",
        style: "dark",
      });
    });

    it("should remap richtext story links and richtext blok bodies", () => {
      const content = mappedContent(
        makeStory({
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    marks: [{ type: "link", attrs: { linktype: "story", uuid: "old-uuid" } }],
                  },
                ],
              },
              { type: "blok", attrs: { body: [{ component: "hero", image: { id: 10 } }] } },
            ],
          },
        }),
        {
          stories: new Map([["old-uuid", "new-uuid"]]),
          mapAsset: swapAssetId(new Map([[10, 20]])),
        },
      );

      expect(content.content).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                marks: [{ type: "link", attrs: { linktype: "story", uuid: "new-uuid" } }],
              },
            ],
          },
          { type: "blok", attrs: { body: [{ component: "hero", image: { id: 20 } }] } },
        ],
      });
    });

    it("should tolerate richtext links and bloks without attrs or body", () => {
      const richtext = { type: "doc", content: [{ type: "link" }, { type: "blok" }] };

      const content = mappedContent(makeStory({ content: richtext }));

      expect(content.content).toEqual({
        type: "doc",
        content: [{ type: "link" }, { type: "blok", attrs: { body: [] } }],
      });
    });

    it("should throw a helpful error for non-array bloks and multiasset values", () => {
      expect(() => map(makeStory({ body: "invalid" }))).toThrow(
        'Invalid bloks field: expected an array, but received "invalid"',
      );
      expect(() => map(makeStory({ gallery: { filename: "a.jpg" } }))).toThrow(
        'Invalid multiasset field: expected an array, but received {"filename":"a.jpg"}',
      );
    });
  });

  describe("result", () => {
    it("should report components without a schema", () => {
      const { missingSchemas } = map(makeStory({ body: [{ component: "unknown" }] }));

      expect([...missingSchemas]).toEqual(["unknown"]);
    });

    it("should report every field schema that matched a field", () => {
      const { processedFields } = map(
        makeStory({ title: "Hi", body: [{ component: "hero", image: null }] }),
      );

      expect([...processedFields]).toEqual(
        expect.arrayContaining([schemas.page.title, schemas.page.body, schemas.hero.image]),
      );
      expect(processedFields.size).toBe(3);
    });
  });
});
