import { describe, expectTypeOf, it } from "vitest";
import type { Block, BlockContent, Story } from "./index";
import type { BlockContentInput } from "./generated/types/field";

type PluginBlock = Block<
  "themed",
  readonly [{ name: "value"; type: "custom"; field_type: "test-plugin"; required: true }]
>;

type ReadValue<T> = BlockContent<PluginBlock, false, { "test-plugin": T }>["value"];
type WriteValue<T> = BlockContentInput<PluginBlock, false, { "test-plugin": T }>["value"];

describe("registered field plugin values", () => {
  it("should preserve required plugin literals on read and write", () => {
    type Value = { color: string; plugin: "official-colorpicker" };
    expectTypeOf<ReadValue<Value>["plugin"]>().toEqualTypeOf<"official-colorpicker">();
    expectTypeOf<WriteValue<Value>["plugin"]>().toEqualTypeOf<"official-colorpicker">();
  });

  it("should preserve numeric plugin properties on read and write", () => {
    type Value = { plugin: number; v: string };
    type Expected = { plugin: number; v: string; _uid?: string };
    expectTypeOf<ReadValue<Value>>().toEqualTypeOf<Expected>();
    expectTypeOf<WriteValue<Value>>().toEqualTypeOf<Expected>();
  });

  it("should add only optional _uid metadata to object values", () => {
    type Expected = { color: string; _uid?: string };
    expectTypeOf<ReadValue<{ color: string }>>().toEqualTypeOf<Expected>();
    expectTypeOf<WriteValue<{ color: string }>>().toEqualTypeOf<Expected>();
  });

  it("should preserve primitive and array values", () => {
    expectTypeOf<ReadValue<string>>().toEqualTypeOf<string>();
    expectTypeOf<WriteValue<string>>().toEqualTypeOf<string>();
    expectTypeOf<ReadValue<readonly [string, number]>>().toEqualTypeOf<readonly [string, number]>();
    expectTypeOf<WriteValue<readonly [string, number]>>().toEqualTypeOf<
      readonly [string, number]
    >();
  });

  // `onStoryblokEditorEvent<TStory extends Story>` requires typed content to fit the loose content type.
  it("should keep content with any plugin output assignable to loose story content", () => {
    type Content<T> = BlockContent<PluginBlock, false, { "test-plugin": T }>;
    expectTypeOf<Content<unknown>>().toExtend<Story["content"]>();
    expectTypeOf<Content<{ color: string }>>().toExtend<Story["content"]>();
    expectTypeOf<Content<number[]>>().toExtend<Story["content"]>();
  });
});
