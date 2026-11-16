import type { StoryblokRichTextInput } from "@storyblok/richtext";
import { describe, expectTypeOf, it } from "vitest";
import type { BlockContentBase } from "../generated/overlay/_internal.gen";
import type {
  AssetFieldValue,
  BlockContent,
  BlockContentInput,
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
 * regenerate can silently change a mapping. Asserting all 19 types here makes the
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
  image: defineField("a", { type: "image" }),
  file: defineField("a", { type: "file" }),
  multilink: defineField("a", { type: "multilink" }),
  bloks: defineField("a", { type: "bloks" }),
  table: defineField("a", { type: "table" }),
  section: defineField("a", { type: "section" }),
  tab: defineField("a", { type: "tab" }),
  group: defineField("a", { type: "group" }),
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
    // The legacy `image`/`file` types store the bare, protocol-relative URL.
    expectTypeOf<FieldValue<typeof _f.image>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.file>>().toEqualTypeOf<string>();
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
    // `section`, `tab` and `group` arrange other fields in the editor and carry
    // no content value, so they must never appear in a content object.
    expectTypeOf<FieldValue<typeof _f.section>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValue<typeof _f.tab>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValue<typeof _f.group>>().toEqualTypeOf<never>();
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
    expectTypeOf<FieldValueInput<typeof _f.image>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.file>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<FieldValueInput<typeof _f.options>>().toEqualTypeOf<string[]>();
    expectTypeOf<FieldValueInput<typeof _f.section>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValueInput<typeof _f.tab>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValueInput<typeof _f.group>>().toEqualTypeOf<never>();
  });
});

/**
 * `option`/`options` narrow to the literal values in their own config. This
 * matrix covers which configurations narrow and which stay `string` because the
 * values are not knowable from the schema.
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
  emptySource: defineField("a", { type: "option", source: "", options: [...ALIGNMENTS] }),
  selfSource: defineField("a", { type: "option", source: "self", options: [...ALIGNMENTS] }),
  multiSelfSource: defineField("a", {
    type: "options",
    source: "self",
    options: [...ALIGNMENTS],
  }),
  remoteSourceWithOptions: defineField("a", {
    type: "option",
    source: "external",
    options: [...ALIGNMENTS],
  }),
  nonLiteralSource: defineField("a", {
    type: "option",
    source: "self" as string,
    options: [...ALIGNMENTS],
  }),
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
    expectTypeOf<FieldValue<typeof _o.excludesEmpty>>().toEqualTypeOf<"" | "left" | "center">();
  });

  it("stays `string` when the values live in the space rather than the schema", () => {
    expectTypeOf<FieldValue<typeof _o.datasource>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _o.stories>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _o.remoteSourceWithOptions>>().toEqualTypeOf<string>();
  });

  it("narrows an empty or `self` source like an omitted one", () => {
    expectTypeOf<FieldValue<typeof _o.emptySource>>().toEqualTypeOf<"" | "left" | "center">();
    expectTypeOf<FieldValue<typeof _o.selfSource>>().toEqualTypeOf<"" | "left" | "center">();
    expectTypeOf<FieldValue<typeof _o.multiSelfSource>>().toEqualTypeOf<("left" | "center")[]>();
  });

  it("stays `string` when the source is not a literal type", () => {
    expectTypeOf<FieldValue<typeof _o.nonLiteralSource>>().toEqualTypeOf<string>();
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

  it("narrows the block's content type", () => {
    // Optional fields are also nullable.
    expectTypeOf<Hero["alignment"]>().toEqualTypeOf<"" | "left" | "center" | null | undefined>();
    expectTypeOf<Hero["tags"]>().toEqualTypeOf<("left" | "center")[]>();
  });
});

describe("layout fields in a block's content type", () => {
  const formBlock = defineBlock({
    name: "form",
    fields: [
      defineField("tab-303dc898-0e4b-4a7e-9b0f-3a1f5f0b6c2d", {
        type: "tab",
        display_name: "Settings",
        keys: ["title", "subtitle"],
      }),
      defineField("contact_details", { type: "section", keys: ["email"] }),
      defineField("legacy_group", { type: "group" }),
      defineField("title", { type: "text", required: true }),
      defineField("subtitle", { type: "text" }),
      defineField("email", { type: "text" }),
    ],
  });

  type Form = BlockContent<typeof formBlock, typeof formBlock>;
  type FormInput = BlockContentInput<typeof formBlock, typeof formBlock>;

  it("leaves tab, section and group keys out of the read content type", () => {
    // Layout fields hold no value, so a story never stores anything under their key.
    expectTypeOf<keyof Form>().toEqualTypeOf<
      "_uid" | "component" | "_editable" | "title" | "subtitle" | "email"
    >();
  });

  it("leaves tab, section and group keys out of the input content type", () => {
    expectTypeOf<keyof FormInput>().toEqualTypeOf<
      "_uid" | "component" | "_editable" | "title" | "subtitle" | "email"
    >();
  });

  it("keeps the fields a layout field arranges, with their required/optional shape", () => {
    expectTypeOf<Form["title"]>().toEqualTypeOf<string>();
    expectTypeOf<Form["subtitle"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Form["email"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<FormInput["title"]>().toEqualTypeOf<string>();
    expectTypeOf<FormInput["subtitle"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<FormInput>().toExtend<{ title: string; subtitle?: string | null }>();
  });

  it("leaves layout keys out of nested blocks resolved through a registry", () => {
    const childBlock = defineBlock({
      name: "child",
      fields: [
        defineField("child_tab", { type: "tab", keys: ["label"] }),
        defineField("label", { type: "text", required: true }),
      ],
    });
    const parentBlock = defineBlock({
      name: "parent",
      fields: [
        defineField("parent_section", { type: "section", keys: ["items"] }),
        defineField("items", { type: "bloks", allow: ["child"] }),
      ],
    });
    type Registry = typeof childBlock | typeof parentBlock;
    type Item = NonNullable<BlockContent<typeof parentBlock, Registry>["items"]>[number];
    type ItemInput = NonNullable<BlockContentInput<typeof parentBlock, Registry>["items"]>[number];

    expectTypeOf<keyof Item>().toEqualTypeOf<"_uid" | "component" | "_editable" | "label">();
    expectTypeOf<keyof ItemInput>().toEqualTypeOf<"_uid" | "component" | "_editable" | "label">();
  });

  it("keeps the base keys when a layout field reuses their name", () => {
    const oddBlock = defineBlock({
      name: "odd",
      fields: [
        defineField("component", { type: "tab", keys: ["title"] }),
        defineField("_uid", { type: "section" }),
        defineField("title", { type: "text" }),
      ],
    });
    type Odd = BlockContent<typeof oddBlock, typeof oddBlock>;

    expectTypeOf<Odd["component"]>().toEqualTypeOf<"odd">();
    expectTypeOf<Odd["_uid"]>().toEqualTypeOf<string>();
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
