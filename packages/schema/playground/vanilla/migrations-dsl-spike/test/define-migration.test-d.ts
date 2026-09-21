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
import type { AfterRenameArticleAuthor, AfterRenameMetaAuthor } from "../fixtures/schema-after";
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
      up: (m) => m.field("spike_article.author").remove(),
    });
  });
});

describe("two schema parameters", () => {
  it("should read the source path from Before and the rename target from After", () => {
    defineMigration<SpikeSchema, AfterRenameArticleAuthor>({
      up: (m) => m.field("spike_article.author").renameTo("byline"),
    });
  });

  it("should reject a rename target the post-migration schema does not declare", () => {
    defineMigration<SpikeSchema, AfterRenameArticleAuthor>({
      // @ts-expect-error "by_line" is not a field of spike_article in After
      up: (m) => m.field("spike_article.author").renameTo("by_line"),
    });
  });

  it("should still reject a source path the pre-migration schema does not declare", () => {
    defineMigration<SpikeSchema, AfterRenameArticleAuthor>({
      // @ts-expect-error "byline" does not exist yet in Before
      up: (m) => m.field("spike_article.byline").remove(),
    });
  });

  it("should reject a rename to a name that only the pre-migration schema has", () => {
    defineMigration<SpikeSchema, AfterRenameMetaAuthor>({
      // @ts-expect-error After renamed it away, so "author" is no longer a target
      up: (m) => m.field("spike_meta.og_title").moveTo("author"),
    });
  });

  it("should leave the single-schema shorthand inferring both ends from one schema", () => {
    defineMigration<SpikeSchema>({
      up: (m) => m.field("spike_card.old_slug").moveTo("slug"),
    });
    defineMigration<SpikeSchema>({
      // @ts-expect-error the shorthand cannot name a field the one schema lacks
      up: (m) => m.field("spike_card.old_slug").moveTo("permalink"),
    });
  });
});

describe("location scoping", () => {
  it("should accept a parent block name and keep the block's own typing", () => {
    defineMigration<SpikeSchema>({
      up: (m) =>
        m
          .block("spike_meta")
          .under("spike_card")
          .alter((block) => {
            expectTypeOf(block.component).toEqualTypeOf<"spike_meta">();
          }),
    });
  });

  it("should reject a parent that is not a block in the schema", () => {
    defineMigration<SpikeSchema>({
      up: (m) =>
        m
          .block("spike_meta")
          // @ts-expect-error no such block
          .under("spike_nope")
          .alter(() => {}),
    });
  });

  it("should expose field ops on a scoped handle", () => {
    defineMigration<SpikeSchema>({
      up: (m) => m.block("spike_meta").under("spike_card").field("og_title").asString(),
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
  it("should keep a section (UI-only) pseudo field out of the migratable paths", () => {
    // `section` lays out the editor form and holds no value, so addressing it
    // in a migration could never do anything.
    expectTypeOf<
      "kitchen_sink.settings_section" extends FieldPathOf<PlaygroundSchema> ? true : false
    >().toEqualTypeOf<false>();
    // It remains a key on the content type — that is `@storyblok/schema`'s
    // `BlockContent`, which the migration DSL does not own.
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
