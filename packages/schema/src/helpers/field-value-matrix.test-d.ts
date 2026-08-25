import type { StoryblokRichTextInput } from "@storyblok/richtext";
import { describe, expectTypeOf, it } from "vitest";
import type { BlockContentBase } from "../generated/overlay/_internal.gen";
import type {
  AssetFieldValue,
  BlockContent,
  FieldValue,
  FieldValueInput,
  MultilinkFieldValue,
  PluginFieldValue,
  RichTextFieldValue,
  TableFieldValue,
} from "../generated/types/field";
import { defineBlock } from "./define-block";
import { defineField } from "./define-field";

/**
 * One assertion per Storyblok field type, covering the full `FieldTypeValueMap`.
 *
 * `FieldValue` is the contract every consumer of a schema depends on, and the map
 * behind it is hand-maintained rather than derived from the OpenAPI spec — a
 * regenerate can silently change a mapping. Asserting all 17 types here makes the
 * map's exhaustiveness reviewable and turns any drift into a failing typecheck.
 */
const _f = {
  text: defineField("a", { type: "text" }),
  textarea: defineField("a", { type: "textarea" }),
  richtext: defineField("a", { type: "richtext" }),
  markdown: defineField("a", { type: "markdown" }),
  number: defineField("a", { type: "number" }),
  datetime: defineField("a", { type: "datetime" }),
  boolean: defineField("a", { type: "boolean" }),
  option: defineField("a", { type: "option" }),
  options: defineField("a", { type: "options" }),
  asset: defineField("a", { type: "asset" }),
  multiasset: defineField("a", { type: "multiasset" }),
  multilink: defineField("a", { type: "multilink" }),
  bloks: defineField("a", { type: "bloks" }),
  table: defineField("a", { type: "table" }),
  section: defineField("a", { type: "section" }),
  tab: defineField("a", { type: "tab" }),
  custom: defineField("a", { type: "custom", field_type: "unregistered" }),
};

describe("FieldValue resolution per field type", () => {
  it("resolves the string-valued field types", () => {
    expectTypeOf<FieldValue<typeof _f.text>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.textarea>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.markdown>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.datetime>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.option>>().toEqualTypeOf<string>();
    // Stored as a string, not a JSON number — see `FieldTypeValueMap`.
    expectTypeOf<FieldValue<typeof _f.number>>().toEqualTypeOf<string>();
  });

  it("resolves the remaining scalar and structured field types", () => {
    expectTypeOf<FieldValue<typeof _f.boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<FieldValue<typeof _f.options>>().toEqualTypeOf<string[]>();
    expectTypeOf<FieldValue<typeof _f.richtext>>().toExtend<RichTextFieldValue>();
    expectTypeOf<FieldValue<typeof _f.asset>>().toExtend<AssetFieldValue>();
    expectTypeOf<FieldValue<typeof _f.multiasset>>().toExtend<AssetFieldValue[]>();
    expectTypeOf<FieldValue<typeof _f.multilink>>().toExtend<MultilinkFieldValue>();
    expectTypeOf<FieldValue<typeof _f.table>>().toExtend<TableFieldValue>();
    expectTypeOf<FieldValue<typeof _f.custom>>().toExtend<PluginFieldValue>();
  });

  it("leaves `bloks` loose when no block registry is threaded through", () => {
    expectTypeOf<FieldValue<typeof _f.bloks>>().toEqualTypeOf<BlockContentBase[]>();
  });

  it("resolves the layout-only field types to `never`", () => {
    // `section` and `tab` group other fields in the editor and carry no content
    // value, so they must never appear in a content object.
    expectTypeOf<FieldValue<typeof _f.section>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValue<typeof _f.tab>>().toEqualTypeOf<never>();
  });
});

describe("FieldValueInput resolution per field type", () => {
  it("matches the read type for every non-blok field type", () => {
    expectTypeOf<FieldValueInput<typeof _f.text>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.textarea>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.markdown>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.datetime>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.option>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.number>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<FieldValueInput<typeof _f.options>>().toEqualTypeOf<string[]>();
    expectTypeOf<FieldValueInput<typeof _f.section>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValueInput<typeof _f.tab>>().toEqualTypeOf<never>();
  });
});

/**
 * `option` and `options` are the only field types whose content type depends on
 * the field's own configuration rather than its `type` alone, so they get their
 * own matrix: which configurations narrow to the literal values, and which stay
 * `string` because the values are not knowable from the schema.
 */
const ALIGNMENTS = [
  { name: "Left", value: "left" },
  { name: "Center", value: "center" },
] as const;

const _o = {
  inline: defineField("a", {
    type: "option",
    options: [
      { name: "Left", value: "left" },
      { name: "Center", value: "center" },
    ],
  }),
  spread: defineField("a", { type: "option", options: [...ALIGNMENTS] }),
  byReference: defineField("a", { type: "option", options: ALIGNMENTS }),
  multi: defineField("a", { type: "options", options: [...ALIGNMENTS] }),
  excludesEmpty: defineField("a", {
    type: "option",
    options: [...ALIGNMENTS],
    exclude_empty_option: true,
  }),
  datasource: defineField("a", { type: "option", source: "internal", datasource: "themes" }),
  stories: defineField("a", { type: "option", source: "internal_stories" }),
  nonLiteralValues: defineField("a", {
    type: "option",
    options: [] as { name: string; value: string }[],
  }),
};

describe("option value narrowing", () => {
  it("narrows a self-sourced `option` to its configured values plus the empty string", () => {
    // An unset option field and a cleared selection both deliver `''`, so it is
    // part of every single-select union.
    expectTypeOf<FieldValue<typeof _o.inline>>().toEqualTypeOf<"" | "left" | "center">();
    expectTypeOf<FieldValueInput<typeof _o.inline>>().toEqualTypeOf<"" | "left" | "center">();
  });

  it("narrows the same whether the options are inline, spread, or shared by reference", () => {
    expectTypeOf<FieldValue<typeof _o.spread>>().toEqualTypeOf<"" | "left" | "center">();
    expectTypeOf<FieldValue<typeof _o.byReference>>().toEqualTypeOf<"" | "left" | "center">();
  });

  it("narrows a multi-select `options` to an array of its values, without the empty string", () => {
    // An unset multi-select delivers `[]`, never `['']`.
    expectTypeOf<FieldValue<typeof _o.multi>>().toEqualTypeOf<("left" | "center")[]>();
    expectTypeOf<FieldValueInput<typeof _o.multi>>().toEqualTypeOf<("left" | "center")[]>();
  });

  it("keeps the empty string even when the editor hides the empty entry", () => {
    // `exclude_empty_option` filters the editor's dropdown; it does not stop the
    // editor from storing `''` when a value falls out of the option list.
    expectTypeOf<FieldValue<typeof _o.excludesEmpty>>().toEqualTypeOf<"" | "left" | "center">();
  });

  it("stays `string` when the values live in the space rather than the schema", () => {
    expectTypeOf<FieldValue<typeof _o.datasource>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _o.stories>>().toEqualTypeOf<string>();
  });

  it("stays `string` when the option values are not literal types", () => {
    expectTypeOf<FieldValue<typeof _o.nonLiteralValues>>().toEqualTypeOf<string>();
  });
});

describe("option narrowing through a block's content type", () => {
  const heroBlock = defineBlock({
    name: "hero",
    fields: [
      defineField("alignment", { type: "option", options: [...ALIGNMENTS] }),
      defineField("tags", { type: "options", options: [...ALIGNMENTS], required: true }),
    ],
  });

  type Hero = BlockContent<typeof heroBlock, typeof heroBlock>;

  it("reaches the content object consumers actually read", () => {
    // Optional fields are additionally nullable, which is what makes the plain
    // `Record<Union, T>` lookup fail to compile until the caller handles it.
    expectTypeOf<Hero["alignment"]>().toEqualTypeOf<"" | "left" | "center" | null | undefined>();
    expectTypeOf<Hero["tags"]>().toEqualTypeOf<("left" | "center")[]>();
  });
});

describe("richtext composition with @storyblok/richtext", () => {
  it("cannot yet be handed to renderRichText", () => {
    // Known gap: `RichtextFieldValue.content` is an optional array of loose
    // records, while `SbRichTextNode.content` is a required array of
    // discriminated nodes, so a schema-typed richtext value cannot be passed to
    // `renderRichText` without a cast.
    //
    // This assertion is expected to fail. When the richtext types are made
    // compatible, the directive below becomes unused and the typecheck fails,
    // which is the signal to delete this test.
    expectTypeOf<RichTextFieldValue>().toExtend<StoryblokRichTextInput>();
  });
});
