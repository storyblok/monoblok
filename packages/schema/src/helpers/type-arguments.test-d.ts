import { z } from "zod";
import { describe, expectTypeOf, it } from "vitest";
import type { BlockContent, BlockContentInput } from "../generated/types/field";
import type { MapiStory, StoryCreate, StoryUpdate } from "../generated/types/mapi-story";
import type { Story } from "../generated/types/story";
import { defineBlock } from "./define-block";
import { defineField } from "./define-field";
import { defineFieldPlugin } from "./define-field-plugin";
import { defineSchema } from "./define-schema";
import type { Schema } from "./schema-type";

const colorPicker = defineFieldPlugin({
  fieldType: "my-color",
  value: z.object({ color: z.string() }),
});

const teaserBlock = defineBlock({
  name: "teaser",
  is_nestable: true,
  fields: [defineField("title", { type: "text", required: true })],
});

const pageBlock = defineBlock({
  name: "page",
  is_root: true,
  fields: [
    defineField("blocks", { type: "bloks" }),
    defineField("bg", { type: "custom", field_type: "my-color" }),
  ],
});

const _schema = defineSchema({
  blocks: { pageBlock, teaserBlock },
  fieldPlugins: { colorPicker },
});

type S = Schema<typeof _schema>;
type Blocks = S["blocks"];
type FieldPlugins = S["fieldPlugins"];

type IsNever<T> = [T] extends [never] ? true : false;

describe("type argument placement", () => {
  it("resolves plugin-typed content when the field plugin map is supplied", () => {
    expectTypeOf<Story<Blocks, FieldPlugins>["content"]["bg"]>().toExtend<
      { color: string } | null | undefined
    >();
  });

  it("never collapses to `never` when both the plugin map and the registry are supplied", () => {
    // Passing the registry explicitly is redundant (`Story` derives it from the
    // block union) but legal, and must resolve rather than silently vanish.
    expectTypeOf<IsNever<Story<Blocks, FieldPlugins, Blocks>>>().toEqualTypeOf<false>();
    expectTypeOf<IsNever<MapiStory<Blocks, FieldPlugins, Blocks>>>().toEqualTypeOf<false>();
    expectTypeOf<IsNever<StoryCreate<Blocks, FieldPlugins, Blocks>>>().toEqualTypeOf<false>();
    expectTypeOf<IsNever<StoryUpdate<Blocks, FieldPlugins, Blocks>>>().toEqualTypeOf<false>();
  });

  it("rejects a field plugin map passed in the block registry position", () => {
    // `BlockContent` takes the plugin map third and `Story` takes it second.
    // Supplying it in the registry slot must be a compile error rather than
    // resolving to `never`, which would make every downstream access legal.
    // @ts-expect-error field plugin maps do not satisfy `Block | NoBlocks`
    expectTypeOf<Story<Blocks, Blocks, FieldPlugins>>().toBeObject();
    // @ts-expect-error field plugin maps do not satisfy `Block | NoBlocks`
    expectTypeOf<MapiStory<Blocks, Blocks, FieldPlugins>>().toBeObject();
    // @ts-expect-error field plugin maps do not satisfy `Block | NoBlocks`
    expectTypeOf<BlockContent<Blocks, FieldPlugins, Blocks>>().toBeObject();
    // @ts-expect-error field plugin maps do not satisfy `Block | NoBlocks`
    expectTypeOf<BlockContentInput<Blocks, FieldPlugins, Blocks>>().toBeObject();
  });
});
