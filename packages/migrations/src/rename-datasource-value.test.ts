import { describe, expect, it } from "vitest";
import { renameDataSourceValue } from "./rename-datasource-value";

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

describe("renameDataSourceValue", () => {
  it("should rename single option field value", () => {
    const story = makeStory({ category: "old-value" });
    const componentsToUpdate = [{ field: "category", name: "page" }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    expect((result.content as any).category).toBe("new-value");
  });

  it("should rename matching values in multi-options array", () => {
    const story = makeStory({ tags: ["old-value", "keep-this", "old-value"] });
    const componentsToUpdate = [{ field: "tags", name: "page" }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    expect((result.content as any).tags).toEqual(["new-value", "keep-this", "new-value"]);
  });

  it("should traverse nested bloks and rename values in nested components", () => {
    const story = makeStory({
      body: [{ component: "card", _uid: "uid1", category: "old-value" }],
    });
    const componentsToUpdate = [{ field: "category", name: "card" }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    expect((result.content as any).body[0].category).toBe("new-value");
  });

  it("should leave non-matching values untouched", () => {
    const story = makeStory({ category: "other-value" });
    const componentsToUpdate = [{ field: "category", name: "page" }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    expect((result.content as any).category).toBe("other-value");
  });

  it("should leave components not in componentsToUpdate untouched", () => {
    const story = makeStory({ category: "old-value" });
    const componentsToUpdate = [{ field: "category", name: "other-component" }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    expect((result.content as any).category).toBe("old-value");
  });

  it("should return changes log with component, field, and path", () => {
    const story = makeStory({ category: "old-value" });
    const componentsToUpdate = [{ field: "category", name: "page" }];
    const { changes } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].component).toBe("page");
    expect(changes[0].field).toBe("category");
  });

  it("should rename datasource value inside a richtext-embedded blok", () => {
    const story = makeStory({
      richtext: {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: {
              id: "blok-node-uid",
              body: [
                {
                  _uid: "uid1",
                  component: "card",
                  category: "old-value",
                },
              ],
            },
          },
        ],
      },
    });
    const componentsToUpdate = [{ field: "category", name: "card" }];
    const { story: result, changes } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    const body = (result.content as any).richtext.content[0].attrs.body;
    expect(body[0].category).toBe("new-value");
    expect(changes).toHaveLength(1);
    expect(changes[0].component).toBe("card");
    expect(changes[0].field).toBe("category");
  });

  it("should leave richtext content with no embedded bloks untouched", () => {
    const story = makeStory({
      richtext: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      },
    });
    const componentsToUpdate = [{ field: "category", name: "card" }];
    const { story: result, changes } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    const richtext = (result.content as any).richtext;
    expect(richtext.content[0].content[0].text).toBe("Hello world");
    expect(changes).toHaveLength(0);
  });

  it("should rename datasource value in a blok nested inside richtext inside another blok", () => {
    const story = makeStory({
      body: [
        {
          _uid: "outer-uid",
          component: "section",
          richtext: {
            type: "doc",
            content: [
              {
                type: "blok",
                attrs: {
                  id: "blok-node-uid",
                  body: [
                    {
                      _uid: "inner-uid",
                      component: "card",
                      category: "old-value",
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
    const componentsToUpdate = [{ field: "category", name: "card" }];
    const { story: result, changes } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    const body = (result.content as any).body[0].richtext.content[0].attrs.body;
    expect(body[0].category).toBe("new-value");
    expect(changes).toHaveLength(1);
  });

  it("should rename multi-option array values inside a richtext-embedded blok", () => {
    const story = makeStory({
      richtext: {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: {
              id: "blok-node-uid",
              body: [
                {
                  _uid: "uid1",
                  component: "card",
                  tags: ["old-value", "keep-this", "old-value"],
                },
              ],
            },
          },
        ],
      },
    });
    const componentsToUpdate = [{ field: "tags", name: "card" }];
    const { story: result, changes } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      "old-value",
      "new-value",
    );
    const body = (result.content as any).richtext.content[0].attrs.body;
    expect(body[0].tags).toEqual(["new-value", "keep-this", "new-value"]);
    expect(changes).toHaveLength(2);
  });
});
