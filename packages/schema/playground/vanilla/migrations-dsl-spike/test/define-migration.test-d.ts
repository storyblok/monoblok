/**
 * SPIKE — type-level probe of `defineMigration<After, Before>` and the op
 * factories.
 *
 * Asserts what the inference actually delivers, and pins the points where it
 * degrades, so the findings are checked by the compiler rather than asserted in
 * prose. The first question the op-list surface raises that the builder did not:
 * a factory is called in the argument list, where the schema appears in no
 * argument, so everything below rests on TypeScript threading the type
 * parameters through the contextual return type.
 */
import { describe, expectTypeOf, it } from "vitest";
import type { AssetFieldValue, MultilinkFieldValue } from "@storyblok/schema";
import { defineMigration } from "../src/define-migration";
import {
  alterBlock,
  alterField,
  coerceField,
  moveField,
  removeField,
  renameField,
  reorderField,
} from "../src/ops";
import type { BlockNameOf, ContentOf, FieldPathOf, ValueOfPath } from "../src/types";
import type { SpikeSchema } from "../fixtures/schema";
import type { AfterRenameArticleAuthor, AfterRenameMetaAuthor } from "../fixtures/schema-after";
import type { Before as ArticleBefore } from "../migrations/0001-rename-article-author.before";
import type { Schema as PlaygroundSchema } from "../../base/schema";

/** Structural equality that tolerates the `Prettify` re-wrapping `toEqualTypeOf` treats as distinct. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe("addressable names", () => {
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

  it("should still derive the exact block/field pairs the schema declares", () => {
    // No longer an addressing surface — there is no path grammar — but it is
    // the set every op's `field` is checked against.
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
});

describe("schema inference through the contextual return type", () => {
  it("should reject a typo in a field name", () => {
    defineMigration<AfterRenameArticleAuthor, SpikeSchema>([
      // @ts-expect-error "authr" is not a field of spike_article
      removeField({ block: "spike_article", field: "authr" }),
    ]);
  });

  it("should reject a field that exists on a different block", () => {
    defineMigration<AfterRenameArticleAuthor, SpikeSchema>([
      // @ts-expect-error "heading" belongs to spike_section, not spike_card
      removeField({ block: "spike_card", field: "heading" }),
    ]);
  });

  it("should reject an unknown block name", () => {
    defineMigration<AfterRenameArticleAuthor, SpikeSchema>([
      // @ts-expect-error no such block
      alterBlock({ block: "spike_nonexistent" }, () => {}),
    ]);
  });

  it("should accept a real field", () => {
    defineMigration<AfterRenameArticleAuthor, SpikeSchema>([
      removeField({ block: "spike_article", field: "author" }),
    ]);
  });
});

describe("two schema parameters", () => {
  it("should read the source field from Before and the rename target from After", () => {
    defineMigration<AfterRenameArticleAuthor, ArticleBefore>([
      renameField({ block: "spike_article", field: "author", to: "byline" }),
    ]);
  });

  it("should reject a rename target the post-migration schema does not declare", () => {
    defineMigration<AfterRenameArticleAuthor, ArticleBefore>([
      // @ts-expect-error "by_line" is not a field of spike_article in After
      renameField({ block: "spike_article", field: "author", to: "by_line" }),
    ]);
  });

  it("should still reject a source field the pre-migration schema does not declare", () => {
    defineMigration<AfterRenameArticleAuthor, ArticleBefore>([
      // @ts-expect-error "byline" does not exist yet in Before
      removeField({ block: "spike_article", field: "byline" }),
    ]);
  });

  it("should reject a move onto a name only the pre-migration schema has", () => {
    defineMigration<AfterRenameMetaAuthor, SpikeSchema>([
      // @ts-expect-error After renamed it away, so "author" is no longer a target
      moveField({ block: "spike_meta", field: "og_title", to: "author" }),
    ]);
  });
});

describe("one schema parameter", () => {
  it("should keep the rename target exact", () => {
    defineMigration<SpikeSchema>([
      moveField({ block: "spike_card", field: "old_slug", to: "slug" }),
    ]);
    defineMigration<SpikeSchema>([
      // @ts-expect-error the one schema does not declare "permalink"
      moveField({ block: "spike_card", field: "old_slug", to: "permalink" }),
    ]);
  });

  it("should widen reads, because the one schema is the post-migration one", () => {
    // The cost of `After` first: under the shorthand a typo in a *source* name
    // compiles. `validateMigration` is what catches it, at run time, against the
    // schema the CLI pulled.
    defineMigration<SpikeSchema>([
      removeField({ block: "spike_card", field: "a_field_this_schema_never_had" }),
      alterBlock({ block: "a_block_this_schema_never_had" }, () => {}),
    ]);
  });
});

describe("the under rule", () => {
  it("should accept an ancestor name on a value op", () => {
    defineMigration<SpikeSchema>([
      alterField({ block: "spike_meta", field: "og_title", under: "spike_card" }, (value) => value),
      alterBlock({ block: "spike_meta", under: "spike_card" }, () => {}),
      reorderField({ block: "spike_section", field: "items", under: "spike_page" }, () => 0),
    ]);
  });

  it("should accept an ordered chain of ancestor names", () => {
    defineMigration<SpikeSchema>([
      alterField(
        { block: "spike_meta", field: "og_title", under: ["spike_section", "spike_card"] },
        (value) => value,
      ),
    ]);
  });

  it("should reject an ancestor that is not a block in the schema", () => {
    defineMigration<SpikeSchema>([
      // @ts-expect-error no such block
      alterBlock({ block: "spike_meta", under: "spike_nope" }, () => {}),
    ]);
    defineMigration<SpikeSchema>([
      // @ts-expect-error no such block, inside a chain
      alterBlock({ block: "spike_meta", under: ["spike_card", "spike_nope"] }, () => {}),
    ]);
  });

  it("should refuse under on every key op", () => {
    defineMigration<AfterRenameMetaAuthor, SpikeSchema>([
      // @ts-expect-error a component's schema is global, so a key op cannot be scoped
      renameField({ block: "spike_meta", field: "author", to: "written_by", under: "spike_card" }),
    ]);
    defineMigration<SpikeSchema>([
      // @ts-expect-error same for removeField
      removeField({ block: "spike_card", field: "description", under: "spike_section" }),
    ]);
    defineMigration<SpikeSchema>([
      // @ts-expect-error same for moveField
      moveField({ block: "spike_card", field: "old_slug", to: "slug", under: "spike_section" }),
    ]);
    defineMigration<SpikeSchema>([
      coerceField({
        block: "spike_card",
        field: "featured",
        to: "boolean",
        // @ts-expect-error same for a coercion
        under: "spike_section",
      }),
    ]);
  });
});

describe("alterBlock() typing", () => {
  it("should type the block argument as that block's content shape", () => {
    defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_card" }, (block) => {
        expectTypeOf(block.component).toEqualTypeOf<"spike_card">();
        expectTypeOf(block._uid).toEqualTypeOf<string>();
        // Required field: non-optional.
        expectTypeOf(block.title).toEqualTypeOf<string>();
        // Optional field: `| null | undefined`, which forces a guard before any
        // string method — the single biggest ergonomic cost of the design.
        expectTypeOf(block.description).toEqualTypeOf<string | null | undefined>();
      }),
    ]);
  });

  it("should resolve a nested bloks field to the allowed child block content", () => {
    defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_card" }, (block) => {
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
    ]);
  });

  it("should reject writing an unknown key on the block", () => {
    defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_card" }, (block) => {
        // @ts-expect-error not a field of spike_card
        block.nope = 1;
      }),
    ]);
  });

  it("should NOT let a block read a field the migration is about to create", () => {
    defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_card" }, (block) => {
        // @ts-expect-error the post-migration field does not exist in the pre-migration schema
        block.price = Number(block.legacy_price);
      }),
    ]);
  });

  it("should keep the block's own typing under an ancestor filter", () => {
    defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_meta", under: "spike_card" }, (block) => {
        expectTypeOf(block.component).toEqualTypeOf<"spike_meta">();
      }),
    ]);
  });
});

describe("alterField() typing", () => {
  it("should type the value as that one field's value", () => {
    defineMigration<SpikeSchema>([
      alterField({ block: "spike_card", field: "description" }, (value, context) => {
        expectTypeOf(value).toEqualTypeOf<string | null | undefined>();
        expectTypeOf(context.language).toEqualTypeOf<string | undefined>();
        expectTypeOf(context.key).toEqualTypeOf<string>();
        return value;
      }),
    ]);
  });

  it("should resolve a bloks field to its child blocks", () => {
    defineMigration<SpikeSchema>([
      alterField({ block: "spike_section", field: "items" }, (value) => {
        expectTypeOf<
          NonNullable<typeof value>[number]["component"]
        >().toEqualTypeOf<"spike_card">();
        return value;
      }),
    ]);
  });
});

describe("call shapes", () => {
  it("should accept a bare array", () => {
    defineMigration<SpikeSchema>([removeField({ block: "spike_card", field: "description" })]);
  });

  it("should accept a title alongside the op list", () => {
    defineMigration<AfterRenameMetaAuthor, SpikeSchema>({
      title: "Rename spike_meta.author",
      ops: [renameField({ block: "spike_meta", field: "author", to: "written_by" })],
    });
  });

  it("should reject an inverse authored as a second op list", () => {
    defineMigration<AfterRenameMetaAuthor, SpikeSchema>({
      ops: [renameField({ block: "spike_meta", field: "author", to: "written_by" })],
      // @ts-expect-error there is no `down`: an inverse is recorded or derived, never authored
      down: [renameField({ block: "spike_meta", field: "written_by", to: "author" })],
    });
  });

  it("should compose, because ops are values", () => {
    const BLOCKS = ["spike_card", "spike_article"] as const;
    defineMigration<SpikeSchema>(BLOCKS.map((block) => alterBlock({ block }, () => {})));
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

describe("under on a key op, past the object literal", () => {
  const scoped = { under: "spike_card" } as const;

  it("should reject a spread that carries it", () => {
    defineMigration<AfterRenameMetaAuthor, SpikeSchema>([
      // @ts-expect-error excess-property checking does not fire on a spread, so the key is declared instead
      renameField({ block: "spike_meta", field: "author", to: "written_by", ...scoped }),
    ]);
  });

  it("should reject a hoisted spec", () => {
    const spec = { block: "spike_card", field: "description", under: "spike_section" } as const;
    defineMigration<SpikeSchema>([
      // @ts-expect-error same rule, same error, from a variable rather than a literal
      removeField(spec),
    ]);
  });

  it("should keep accepting a value op built the same way", () => {
    defineMigration<SpikeSchema>([alterBlock({ block: "spike_meta", ...scoped }, () => {})]);
  });
});
