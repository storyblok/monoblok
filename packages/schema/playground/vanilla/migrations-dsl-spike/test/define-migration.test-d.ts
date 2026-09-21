/**
 * SPIKE — type-level probe of `defineMigration<Schema>`.
 *
 * Asserts what the inference actually delivers, and pins the points where it
 * degrades, so the findings are checked by the compiler rather than asserted in
 * prose.
 */
import { describe, expectTypeOf, it } from "vitest";
import type { AssetFieldValue, MultilinkFieldValue } from "@storyblok/schema";
import { defineMigration } from "../src/define-migration";
import type { BlockNameOf, ContentOf, FieldPathOf, ValueOfPath } from "../src/types";
import type { SpikeSchema } from "../fixtures/schema";
import type { Schema as PlaygroundSchema } from "../../base/schema";

/** Structural equality that tolerates the `Prettify` re-wrapping `toEqualTypeOf` treats as distinct. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe("field path union", () => {
  it("should be the exact set of block.field pairs in the schema", () => {
    expectTypeOf<FieldPathOf<SpikeSchema>>().toEqualTypeOf<
      | "spike_page.title"
      | "spike_page.body"
      | "spike_article.title"
      | "spike_article.author"
      | "spike_article.excerpt"
      | "spike_article.body"
      | "spike_section.heading"
      | "spike_section.items"
      | "spike_section.meta"
      | "spike_card.title"
      | "spike_card.description"
      | "spike_card.legacy_price"
      | "spike_card.featured"
      | "spike_card.old_slug"
      | "spike_card.slug"
      | "spike_card.meta"
      | "spike_meta.author"
      | "spike_meta.og_title"
      | "spike_banner.label"
    >();
  });

  it("should address blocks by name only, at any depth", () => {
    expectTypeOf<BlockNameOf<SpikeSchema>>().toEqualTypeOf<
      | "spike_page"
      | "spike_article"
      | "spike_section"
      | "spike_card"
      | "spike_meta"
      | "spike_banner"
    >();
  });

  it("should reject a typo in a field path", () => {
    defineMigration<SpikeSchema>({
      // @ts-expect-error "authr" is not a field of spike_article
      up: (m) => m.field("spike_article.authr").renameTo("byline"),
    });
  });

  it("should reject a field that exists on a different block", () => {
    defineMigration<SpikeSchema>({
      // @ts-expect-error "heading" belongs to spike_section, not spike_card
      up: (m) => m.field("spike_card.heading").remove(),
    });
  });

  it("should reject an unknown block name", () => {
    defineMigration<SpikeSchema>({
      // @ts-expect-error no such block
      up: (m) => m.block("spike_nonexistent").alter(() => {}),
    });
  });

  it("should accept a real path", () => {
    defineMigration<SpikeSchema>({
      up: (m) => m.field("spike_article.author").renameTo("byline"),
    });
  });
});

describe("alter() block typing", () => {
  it("should type the block argument as that block's content shape", () => {
    defineMigration<SpikeSchema>({
      up: (m) =>
        m.block("spike_card").alter((block) => {
          expectTypeOf(block.component).toEqualTypeOf<"spike_card">();
          expectTypeOf(block._uid).toEqualTypeOf<string>();
          // Required field: non-optional.
          expectTypeOf(block.title).toEqualTypeOf<string>();
          // Optional field: `| null | undefined`, which forces a guard before
          // any string method — the single biggest ergonomic cost of the design.
          expectTypeOf(block.description).toEqualTypeOf<string | null | undefined>();
        }),
    });
  });

  it("should resolve a nested bloks field to the allowed child block content", () => {
    defineMigration<SpikeSchema>({
      up: (m) =>
        m.block("spike_card").alter((block) => {
          const meta = block.meta?.[0];
          expectTypeOf(meta).toEqualTypeOf<
            | {
                _uid: string;
                component: "spike_meta";
                _editable?: string;
                author?: string | null;
                og_title?: string | null;
              }
            | undefined
          >();
        }),
    });
  });

  it("should reject writing an unknown key on the block", () => {
    defineMigration<SpikeSchema>({
      up: (m) =>
        m.block("spike_card").alter((block) => {
          // @ts-expect-error not a field of spike_card
          block.nope = 1;
        }),
    });
  });

  it("should NOT reject reading a field the migration is about to create", () => {
    defineMigration<SpikeSchema>({
      up: (m) =>
        m.block("spike_card").alter((block) => {
          // @ts-expect-error the post-migration field does not exist in the pre-migration schema
          block.price = Number(block.legacy_price);
        }),
    });
  });
});

describe("value typing of a path", () => {
  it("should resolve scalar fields", () => {
    expectTypeOf<ValueOfPath<SpikeSchema, "spike_article.author">>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it("should resolve plugin and structured fields on the shipped playground schema", () => {
    expectTypeOf<ValueOfPath<PlaygroundSchema, "hero.image">>().toEqualTypeOf<
      AssetFieldValue | null | undefined
    >();
    expectTypeOf<
      MutuallyAssignable<
        NonNullable<ValueOfPath<PlaygroundSchema, "hero.cta_link">>,
        MultilinkFieldValue
      >
    >().toEqualTypeOf<true>();
    // A registered field plugin narrows the `custom` field to the plugin's value.
    expectTypeOf<NonNullable<ValueOfPath<PlaygroundSchema, "hero.accent_color">>>().toEqualTypeOf<{
      color: string;
      plugin: string;
      _uid?: string;
    }>();
  });

  it("should widen an unrestricted bloks field to every nestable block in the schema", () => {
    type Value = ValueOfPath<PlaygroundSchema, "kitchen_sink.bloks_field">;
    // No `allow`, so the child widens to every *nestable* block in the schema.
    // Root-only blocks are correctly excluded.
    expectTypeOf<NonNullable<Value>[number]["component"]>().toEqualTypeOf<
      "hero" | "feature_card" | "kitchen_sink" | "empty_block"
    >();
  });

  it("should narrow a restricted bloks field to the allowed blocks", () => {
    type Value = ValueOfPath<SpikeSchema, "spike_section.items">;
    expectTypeOf<NonNullable<Value>[number]["component"]>().toEqualTypeOf<"spike_card">();
  });
});

describe("content shape of a block", () => {
  it("should include a section (UI-only) pseudo field as a content key", () => {
    // `section` is an editor-layout field with no content value; it still shows
    // up as a migratable path and as a key on the content type.
    expectTypeOf<
      "kitchen_sink.settings_section" extends FieldPathOf<PlaygroundSchema> ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      "settings_section" extends keyof ContentOf<PlaygroundSchema, "kitchen_sink"> ? true : false
    >().toEqualTypeOf<true>();
  });

  it("should give an empty-fields block only the envelope keys", () => {
    expectTypeOf<keyof ContentOf<PlaygroundSchema, "empty_block">>().toEqualTypeOf<
      "_uid" | "component" | "_editable"
    >();
  });
});
