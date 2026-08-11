import { describe, expectTypeOf, it } from "vitest";
import type { BlockContent, BlockContentInput, PluginFieldValue } from "../generated/types/field";
import { defineBlock } from "./define-block";
import { defineField } from "./define-field";

/**
 * `tab` and `section` group other fields in the editor UI and carry no value of
 * their own, so no API response ever has a key for them. They used to surface as
 * `key?: null` properties, which put phantom keys in autocomplete on every block
 * using a tab.
 */
describe("layout-only fields", () => {
  const _heroBlock = defineBlock({
    name: "hero",
    fields: [
      defineField("general", { type: "tab" }),
      defineField("divider", { type: "section" }),
      defineField("title", { type: "text" }),
      defineField("headline", { type: "text", required: true }),
    ],
  });

  type Content = BlockContent<typeof _heroBlock>;
  type ContentInput = BlockContentInput<typeof _heroBlock>;

  it("omits a tab field from the read content type", () => {
    expectTypeOf<Content>().not.toHaveProperty("general");
  });

  it("omits a section field from the read content type", () => {
    expectTypeOf<Content>().not.toHaveProperty("divider");
  });

  it("omits layout fields from the write content type too", () => {
    expectTypeOf<ContentInput>().not.toHaveProperty("general");
    expectTypeOf<ContentInput>().not.toHaveProperty("divider");
  });

  it("keeps the value-carrying fields around them", () => {
    expectTypeOf<Content>().toHaveProperty("title");
    expectTypeOf<Content["headline"]>().toEqualTypeOf<string>();
  });

  it("accepts content that omits the layout keys entirely", () => {
    const content: Content = { _uid: "a", component: "hero", headline: "Hi" };
    expectTypeOf(content).toExtend<Content>();
  });
});

/**
 * The guard drops fields whose value is `never`. A `custom` field with no
 * registered plugin resolves to `PluginFieldValue`, not `never`, so it must
 * survive — dropping it would silently hide the field instead of typing it
 * loosely.
 */
describe("fields that must not be mistaken for layout fields", () => {
  const _block = defineBlock({
    name: "widget",
    fields: [
      defineField("legacy", { type: "custom", field_type: "unregistered-plugin" }),
      defineField("items", { type: "bloks" }),
    ],
  });

  type Content = BlockContent<typeof _block>;

  it("keeps an unregistered custom field, typed loosely", () => {
    expectTypeOf<NonNullable<Content["legacy"]>>().toEqualTypeOf<PluginFieldValue>();
  });

  it("keeps a bloks field whose registry resolves to no blocks", () => {
    expectTypeOf<Content>().toHaveProperty("items");
  });
});
