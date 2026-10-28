import { z } from "zod";
import { describe, expectTypeOf, it } from "vitest";
import { storyblokColorField } from "../field-plugins/storyblok-color-field";
import type { BlockContentInput, PluginFieldValue } from "../generated/types/field";
import type { Story } from "../generated/types/story";
import { defineBlock } from "./define-block";
import { defineField } from "./define-field";
import { defineFieldPlugin } from "./define-field-plugin";
import { defineSchema } from "./define-schema";
import type { Schema } from "./schema-type";

const colorPicker = defineFieldPlugin({
  fieldType: "my-color",
  value: z.object({ color: z.string(), alpha: z.number() }),
});

interface ColorEnvelope {
  color: string;
  alpha: number;
  _uid?: string;
}

const fieldPlugins = {
  colorPicker,
  storyblokColorField,
  declared: defineFieldPlugin({
    fieldType: "declared-plugin",
    value: z.strictObject({ plugin: z.literal("p"), v: z.string() }),
  }),
  numeric: defineFieldPlugin({
    fieldType: "numeric-plugin",
    value: z.strictObject({ plugin: z.number(), v: z.string() }),
  }),
  text: defineFieldPlugin({ fieldType: "text-plugin", value: z.string() }),
  branded: defineFieldPlugin({ fieldType: "branded-plugin", value: z.string().brand<"Hex">() }),
  any: defineFieldPlugin({ fieldType: "any-plugin", value: z.any() }),
  number: defineFieldPlugin({ fieldType: "number-plugin", value: z.number() }),
  boolean: defineFieldPlugin({ fieldType: "boolean-plugin", value: z.boolean() }),
  array: defineFieldPlugin({ fieldType: "array-plugin", value: z.array(z.string()) }),
  tuple: defineFieldPlugin({
    fieldType: "tuple-plugin",
    value: z.tuple([z.string(), z.number()]).readonly(),
  }),
  union: defineFieldPlugin({
    fieldType: "union-plugin",
    value: z.union([z.string(), z.strictObject({ color: z.string(), alpha: z.number() })]),
  }),
  placeholder: defineFieldPlugin({
    fieldType: "placeholder-plugin",
    value: {
      "~standard": {
        version: 1,
        vendor: "storyblok-placeholder",
        validate: (value: unknown) => ({ value }),
      },
    },
  }),
};

describe("custom field plugin resolution (read + write share one type)", () => {
  const heroBlock = defineBlock({
    name: "hero",
    is_root: true,
    fields: [
      defineField("bg", { type: "custom", field_type: "my-color" }),
      defineField("legacy", { type: "custom", field_type: "unregistered-plugin" }),
      defineField("legacyRequired", {
        type: "custom",
        field_type: "unregistered-plugin",
        required: true,
      }),
      defineField("text", { type: "custom", field_type: "text-plugin" }),
      defineField("branded", { type: "custom", field_type: "branded-plugin" }),
      defineField("any", { type: "custom", field_type: "any-plugin" }),
      defineField("number", { type: "custom", field_type: "number-plugin" }),
      defineField("boolean", { type: "custom", field_type: "boolean-plugin" }),
      defineField("array", { type: "custom", field_type: "array-plugin" }),
      defineField("tuple", { type: "custom", field_type: "tuple-plugin" }),
      defineField("union", { type: "custom", field_type: "union-plugin" }),
      defineField("placeholder", { type: "custom", field_type: "placeholder-plugin" }),
      defineField("official", {
        type: "custom",
        field_type: "storyblok-colorpicker",
        required: true,
      }),
      defineField("declared", { type: "custom", field_type: "declared-plugin", required: true }),
      defineField("numeric", { type: "custom", field_type: "numeric-plugin", required: true }),
    ],
  });

  const _schema = defineSchema({ blocks: { heroBlock }, fieldPlugins });
  type S = Schema<typeof _schema>;
  type HeroStory = Story<S["blocks"], S["fieldPlugins"]>;
  type HeroInput = BlockContentInput<typeof heroBlock, false, S["fieldPlugins"]>;

  it("should resolve registered object values with only optional _uid metadata", () => {
    expectTypeOf<NonNullable<HeroStory["content"]["bg"]>>().toEqualTypeOf<ColorEnvelope>();
  });

  it("leaves an unregistered custom field as PluginFieldValue", () => {
    expectTypeOf<HeroStory["content"]["legacy"]>().toEqualTypeOf<PluginFieldValue | undefined>();
  });

  it("should resolve the same optional metadata on the write (input) side", () => {
    expectTypeOf<NonNullable<HeroInput["bg"]>>().toEqualTypeOf<ColorEnvelope>();
  });

  it("should preserve the official color field's required plugin literal on read and write", () => {
    expectTypeOf<
      HeroStory["content"]["official"]["plugin"]
    >().toEqualTypeOf<"official-colorpicker">();
    expectTypeOf<HeroInput["official"]["plugin"]>().toEqualTypeOf<"official-colorpicker">();
  });

  it("should preserve declared plugin properties on read and write", () => {
    type Value = { plugin: "p"; v: string; _uid?: string };
    expectTypeOf<HeroStory["content"]["declared"]>().toEqualTypeOf<Value>();
    expectTypeOf<HeroInput["declared"]>().toEqualTypeOf<Value>();
    type NumericValue = { plugin: number; v: string; _uid?: string };
    expectTypeOf<HeroStory["content"]["numeric"]>().toEqualTypeOf<NumericValue>();
    expectTypeOf<HeroInput["numeric"]>().toEqualTypeOf<NumericValue>();
  });

  it("should preserve primitive plugin values on read and write", () => {
    expectTypeOf<NonNullable<HeroStory["content"]["text"]>>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<HeroInput["text"]>>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<HeroStory["content"]["number"]>>().toEqualTypeOf<number>();
    expectTypeOf<NonNullable<HeroInput["number"]>>().toEqualTypeOf<number>();
    expectTypeOf<NonNullable<HeroStory["content"]["boolean"]>>().toEqualTypeOf<boolean>();
    expectTypeOf<NonNullable<HeroInput["boolean"]>>().toEqualTypeOf<boolean>();
  });

  it("should keep a branded primitive output a primitive on read and write", () => {
    type Hex = string & z.$brand<"Hex">;
    expectTypeOf<NonNullable<HeroStory["content"]["branded"]>>().toEqualTypeOf<Hex>();
    expectTypeOf<NonNullable<HeroInput["branded"]>>().toEqualTypeOf<Hex>();
  });

  it("should keep an any output as any on read and write", () => {
    expectTypeOf<HeroStory["content"]["any"]>().toBeAny();
    expectTypeOf<HeroInput["any"]>().toBeAny();
  });

  it("should preserve arrays and readonly tuples on read and write", () => {
    expectTypeOf<NonNullable<HeroStory["content"]["array"]>>().toEqualTypeOf<string[]>();
    expectTypeOf<NonNullable<HeroInput["array"]>>().toEqualTypeOf<string[]>();
    expectTypeOf<NonNullable<HeroStory["content"]["tuple"]>>().toEqualTypeOf<
      readonly [string, number]
    >();
    expectTypeOf<NonNullable<HeroInput["tuple"]>>().toEqualTypeOf<readonly [string, number]>();
  });

  it("should distribute optional metadata only over object members of a union", () => {
    expectTypeOf<NonNullable<HeroStory["content"]["union"]>>().toEqualTypeOf<
      string | ColorEnvelope
    >();
    expectTypeOf<NonNullable<HeroInput["union"]>>().toEqualTypeOf<string | ColorEnvelope>();
  });

  it("should exclude null from a required unregistered field", () => {
    expectTypeOf<HeroStory["content"]["legacyRequired"]>().toEqualTypeOf<
      NonNullable<PluginFieldValue>
    >();
  });

  it("should resolve an unknown plugin output to PluginFieldValue", () => {
    expectTypeOf<HeroStory["content"]["placeholder"]>().toEqualTypeOf<
      PluginFieldValue | undefined
    >();
    expectTypeOf<HeroInput["placeholder"]>().toEqualTypeOf<PluginFieldValue | undefined>();
  });

  it("should accept primitive, array and object values without plugin for an unregistered field", () => {
    type Values = 4 | "x" | string[] | { color: string };
    expectTypeOf<Values>().toExtend<HeroStory["content"]["legacy"]>();
    expectTypeOf<Values>().toExtend<HeroInput["legacy"]>();
  });

  it("should allow primitive, array and object values for an unrestricted placeholder", () => {
    type Values = string | number | boolean | string[] | { color: string } | null | undefined;
    expectTypeOf<Values>().toExtend<HeroStory["content"]["placeholder"]>();
    expectTypeOf<Values>().toExtend<HeroInput["placeholder"]>();
  });

  it("falls back to PluginFieldValue for every custom field when no plugins are registered", () => {
    const _bareSchema = defineSchema({ blocks: { heroBlock } });
    type Bare = Schema<typeof _bareSchema>;
    type BareStory = Story<Bare["blocks"], Bare["fieldPlugins"]>;
    expectTypeOf<BareStory["content"]["bg"]>().toEqualTypeOf<PluginFieldValue | undefined>();
  });
});

describe("custom field plugin resolution inside nested bloks", () => {
  const cardBlock = defineBlock({
    name: "card",
    fields: [defineField("bg", { type: "custom", field_type: "my-color" })],
  });

  const pageBlock = defineBlock({
    name: "page",
    is_root: true,
    fields: [defineField("body", { type: "bloks", allow: ["card"] })],
  });

  const _schema = defineSchema({ blocks: { pageBlock, cardBlock }, fieldPlugins: { colorPicker } });
  type S = Schema<typeof _schema>;
  type PageStory = Story<S["blocks"], S["fieldPlugins"]>;

  it("threads the plugin map into nested block content", () => {
    type CardContent = Extract<
      NonNullable<PageStory["content"]["body"]>[number],
      { component: "card" }
    >;
    expectTypeOf<NonNullable<CardContent["bg"]>>().toEqualTypeOf<ColorEnvelope>();
  });
});
