import { describe, expect, it } from "vitest";
import { defineField } from "./define-field";
import { defineFolder } from "./define-folder";
import { defineBlock } from "./define-block";

describe("defineBlock", () => {
  it("should return a type safe block", () => {
    const input = {
      name: "page",
      fields: [defineField("headline", { type: "text" })],
    };
    const result = defineBlock(input);

    expect(result).toEqual({
      id: 1,
      created_at: "",
      updated_at: "",
      is_root: false,
      is_nestable: true,
      name: "page",
      fields: [{ type: "text", name: "headline", pos: 0 }],
    });
  });

  it("should throw when two fields share the same name", () => {
    expect(() =>
      defineBlock({
        name: "page",
        fields: [
          defineField("headline", { type: "text" }),
          defineField("headline", { type: "textarea" }),
        ],
      }),
    ).toThrow(/duplicate field name "headline"/);
  });

  it("should normalize a folder ref to its display path", () => {
    const heros = defineFolder({ name: "Heros", parent: defineFolder({ name: "Layout" }) });
    const block = defineBlock({ name: "hero", folder: heros, fields: [] });
    expect(block.folder).toBe("Layout/Heros");
  });

  it("should keep a folder path string as written", () => {
    const block = defineBlock({ name: "hero", folder: "Layout/Heros", fields: [] });
    expect(block.folder).toBe("Layout/Heros");
  });

  it("should keep folder: null (explicitly ungrouped)", () => {
    const block = defineBlock({ name: "hero", folder: null, fields: [] });
    expect(block.folder).toBeNull();
  });

  it("should leave folder absent when not set (unmanaged)", () => {
    const block = defineBlock({ name: "hero", fields: [] });
    expect("folder" in block).toBe(false);
  });

  it("should throw when folder and component_group_uuid are both set", () => {
    expect(() =>
      defineBlock({
        name: "hero",
        folder: "Layout",
        component_group_uuid: "abc-123",
        fields: [],
      }),
    ).toThrow('defineBlock: block "hero" sets both "folder" and "component_group_uuid"; use one');
  });

  it("should throw when folder is an empty string", () => {
    expect(() => defineBlock({ name: "hero", folder: "", fields: [] })).toThrow(
      'defineBlock: block "hero" has an empty "folder" path',
    );
  });

  it('should throw when folder is just "/"', () => {
    expect(() => defineBlock({ name: "hero", folder: "/", fields: [] })).toThrow(
      'defineBlock: block "hero" has an empty "folder" path',
    );
  });

  it("should throw when folder is whitespace-only", () => {
    expect(() => defineBlock({ name: "hero", folder: "   ", fields: [] })).toThrow(
      'defineBlock: block "hero" has an empty "folder" path',
    );
  });

  it("should throw when folder has only empty segments", () => {
    expect(() => defineBlock({ name: "hero", folder: "//", fields: [] })).toThrow(
      'defineBlock: block "hero" has an empty "folder" path',
    );
  });

  it("should not throw when folder is a valid trailing-slash path", () => {
    expect(() => defineBlock({ name: "hero", folder: "Layout/", fields: [] })).not.toThrow();
  });

  it("should not throw when folder is a plain valid path", () => {
    expect(() => defineBlock({ name: "hero", folder: "Layout", fields: [] })).not.toThrow();
  });

  it("should keep tags as the names given", () => {
    const block = defineBlock({ name: "hero", tags: ["Marketing", "Beta"], fields: [] });
    expect(block.tags).toEqual(["Marketing", "Beta"]);
  });

  it("should throw when tags and internal_tag_ids are both set", () => {
    expect(() =>
      defineBlock({ name: "hero", tags: ["Marketing"], internal_tag_ids: ["123"], fields: [] }),
    ).toThrow('defineBlock: block "hero" sets both "tags" and "internal_tag_ids"; use one');
  });

  it("should throw when a tag name is blank", () => {
    expect(() => defineBlock({ name: "hero", tags: ["Marketing", "  "], fields: [] })).toThrow(
      'defineBlock: block "hero" has an empty or non-string entry in "tags"',
    );
  });

  it("should omit tags entirely when not given", () => {
    expect(defineBlock({ name: "hero", fields: [] })).not.toHaveProperty("tags");
  });
});
