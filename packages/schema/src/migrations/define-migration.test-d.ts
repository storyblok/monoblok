/**
 * Type-level probe of `defineMigration<After, Before>` and the op factories.
 *
 * Asserts what the inference actually delivers, and pins the points where it
 * degrades, so the findings are checked by the compiler rather than asserted in
 * prose. The first question the op-list surface raises that the builder did not:
 * a factory is called in the argument list, where the schema appears in no
 * argument, so everything below rests on TypeScript threading the type
 * parameters through the contextual return type.
 */
import { describe, expectTypeOf, it } from "vitest";
import type { AssetFieldValue, MultilinkFieldValue } from "../index";
import { defineMigration } from "./define-migration";
import {
  addField,
  alterBlock,
  expandBlock,
  alterField,
  coerceField,
  mergeFields,
  moveField,
  removeField,
  renameBlock,
  renameField,
  reorderField,
  splitField,
  unwrapChildren,
  wrapChildren,
} from "./ops";
import type { BlockNameOf, ContentOf, FieldPathOf, ValueOfPath } from "./types";
import type { ProbeFieldTypesSchema, FixtureSchema } from "./__fixtures__/schema";
import type { AfterRenameArticleAuthor, AfterRenameMetaAuthor } from "./__fixtures__/schema-after";
import type { Before as ArticleBefore } from "./__fixtures__/0001-rename-article-author.before";

/** Structural equality that tolerates the `Prettify` re-wrapping `toEqualTypeOf` treats as distinct. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe("addressable names", () => {
  it("should address blocks by name only, at any depth", () => {
    expectTypeOf<BlockNameOf<FixtureSchema>>().toEqualTypeOf<
      "page" | "article" | "section" | "card" | "meta" | "banner"
    >();
  });

  it("should still derive the exact block/field pairs the schema declares", () => {
    // No longer an addressing surface — there is no path grammar — but it is
    // the set every op's `field` is checked against.
    expectTypeOf<FieldPathOf<FixtureSchema>>().toEqualTypeOf<
      | "page.title"
      | "page.body"
      | "article.title"
      | "article.author"
      | "article.excerpt"
      | "article.body"
      | "section.heading"
      | "section.items"
      | "section.meta"
      | "card.title"
      | "card.description"
      | "card.legacy_price"
      | "card.featured"
      | "card.old_slug"
      | "card.slug"
      | "card.meta"
      | "meta.author"
      | "meta.og_title"
      | "banner.label"
    >();
  });
});

describe("schema inference through the contextual return type", () => {
  it("should reject a typo in a field name", () => {
    defineMigration<AfterRenameArticleAuthor, FixtureSchema>([
      // @ts-expect-error "authr" is not a field of article
      removeField({ block: "article", field: "authr" }),
    ]);
  });

  it("should reject a field that exists on a different block", () => {
    defineMigration<AfterRenameArticleAuthor, FixtureSchema>([
      // @ts-expect-error "heading" belongs to section, not card
      removeField({ block: "card", field: "heading" }),
    ]);
  });

  it("should reject an unknown block name", () => {
    defineMigration<AfterRenameArticleAuthor, FixtureSchema>([
      // @ts-expect-error no such block
      alterBlock({ block: "nonexistent" }, () => {}),
    ]);
    defineMigration<AfterRenameArticleAuthor, FixtureSchema>([
      // @ts-expect-error no such block
      expandBlock({ block: "nonexistent" }, (block) => [block]),
    ]);
  });

  it("should accept a real field", () => {
    defineMigration<AfterRenameArticleAuthor, FixtureSchema>([
      removeField({ block: "article", field: "author" }),
    ]);
  });
});

describe("two schema parameters", () => {
  it("should read the source field from Before and the rename target from After", () => {
    defineMigration<AfterRenameArticleAuthor, ArticleBefore>([
      renameField({ block: "article", field: "author", to: "byline" }),
    ]);
  });

  it("should reject a rename target the post-migration schema does not declare", () => {
    defineMigration<AfterRenameArticleAuthor, ArticleBefore>([
      // @ts-expect-error "by_line" is not a field of article in After
      renameField({ block: "article", field: "author", to: "by_line" }),
    ]);
  });

  it("should still reject a source field the pre-migration schema does not declare", () => {
    defineMigration<AfterRenameArticleAuthor, ArticleBefore>([
      // @ts-expect-error "byline" does not exist yet in Before
      removeField({ block: "article", field: "byline" }),
    ]);
  });

  it("should reject a move onto a name only the pre-migration schema has", () => {
    defineMigration<AfterRenameMetaAuthor, FixtureSchema>([
      // @ts-expect-error After renamed it away, so "author" is no longer a target
      moveField({ block: "meta", field: "og_title", to: "author" }),
    ]);
  });
});

describe("one schema parameter", () => {
  it("should keep the rename target exact", () => {
    defineMigration<FixtureSchema>([moveField({ block: "card", field: "old_slug", to: "slug" })]);
    defineMigration<FixtureSchema>([
      // @ts-expect-error the one schema does not declare "permalink"
      moveField({ block: "card", field: "old_slug", to: "permalink" }),
    ]);
  });

  it("should widen reads, because the one schema is the post-migration one", () => {
    // The cost of `After` first: under the shorthand a typo in a *source* name
    // compiles. `validateMigration` is what catches it, at run time, against the
    // schema the CLI pulled.
    defineMigration<FixtureSchema>([
      removeField({ block: "card", field: "a_field_this_schema_never_had" }),
      alterBlock({ block: "a_block_this_schema_never_had" }, () => {}),
    ]);
  });
});

describe("the under rule", () => {
  it("should accept an ancestor name on a value op", () => {
    defineMigration<FixtureSchema>([
      alterField({ block: "meta", field: "og_title", under: "card" }, (value) => value),
      alterBlock({ block: "meta", under: "card" }, () => {}),
      reorderField({ block: "section", field: "items", under: "page" }, () => 0),
    ]);
  });

  it("should accept an ancestor name on expandBlock, which replaces instances rather than moving a schema", () => {
    defineMigration<FixtureSchema>([
      expandBlock({ block: "meta", under: "card" }, (block) => [block]),
    ]);
    defineMigration<FixtureSchema>([
      // @ts-expect-error no such block
      expandBlock({ block: "meta", under: "nope" }, (block) => [block]),
    ]);
  });

  it("should accept an ordered chain of ancestor names", () => {
    defineMigration<FixtureSchema>([
      alterField(
        { block: "meta", field: "og_title", under: ["section", "card"] },
        (value) => value,
      ),
    ]);
  });

  it("should reject an ancestor that is not a block in the schema", () => {
    defineMigration<FixtureSchema>([
      // @ts-expect-error no such block
      alterBlock({ block: "meta", under: "nope" }, () => {}),
    ]);
    defineMigration<FixtureSchema>([
      // @ts-expect-error no such block, inside a chain
      alterBlock({ block: "meta", under: ["card", "nope"] }, () => {}),
    ]);
  });

  it("should refuse under on every key op", () => {
    defineMigration<AfterRenameMetaAuthor, FixtureSchema>([
      // @ts-expect-error a component's schema is global, so a key op cannot be scoped
      renameField({ block: "meta", field: "author", to: "written_by", under: "card" }),
    ]);
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for removeField
      removeField({ block: "card", field: "description", under: "section" }),
    ]);
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for moveField
      moveField({ block: "card", field: "old_slug", to: "slug", under: "section" }),
    ]);
    defineMigration<FixtureSchema>([
      coerceField({
        block: "card",
        field: "featured",
        to: "boolean",
        // @ts-expect-error same for a coercion
        under: "section",
      }),
    ]);
  });

  // The ops whose spec does not fit `KeyOpSpec` — several fields, no field at
  // all, a container name — carry the same rule, so the message is reachable
  // for every key op rather than for the four the interface happens to fit.
  //
  // Every spec here is hoisted on purpose. On a fresh object literal the error
  // comes from excess-property checking, which fires whether or not the member
  // is declared, so a literal proves nothing about the rule: it is the hoisted
  // spec that only the declared member catches.
  it("should refuse under on a key op whose spec the shared interface does not fit", () => {
    const addSpec = { block: "card", field: "slug", under: "section" } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for addField
      addField(addSpec, () => "x"),
    ]);

    const splitSpec = {
      block: "card",
      field: "title",
      into: ["slug"],
      under: "section",
    } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for splitField
      splitField(splitSpec, (value) => [value]),
    ]);

    const mergeSpec = {
      block: "card",
      fields: ["title", "description"],
      into: "slug",
      under: "section",
    } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for mergeFields
      mergeFields(mergeSpec, (values) => values.join(" ")),
    ]);

    const renameSpec = { block: "card", to: "teaser", under: "section" } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for renameBlock
      renameBlock(renameSpec),
    ]);

    const wrapSpec = {
      block: "section",
      field: "items",
      in: "card",
      into: "items",
      under: "page",
    } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for wrapChildren
      wrapChildren(wrapSpec),
    ]);

    const unwrapSpec = {
      block: "section",
      field: "items",
      unwrap: "card",
      from: "meta",
      under: "page",
    } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same for unwrapChildren
      unwrapChildren(unwrapSpec),
    ]);
  });
});

describe("alterBlock() typing", () => {
  it("should type the block argument as that block's content shape", () => {
    defineMigration<FixtureSchema>([
      alterBlock({ block: "card" }, (block) => {
        expectTypeOf(block.component).toEqualTypeOf<"card">();
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
    defineMigration<FixtureSchema>([
      alterBlock({ block: "card" }, (block) => {
        const meta = block.meta?.[0];
        expectTypeOf(meta).toEqualTypeOf<
          | {
              _uid: string;
              component: "meta";
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
    defineMigration<FixtureSchema>([
      alterBlock({ block: "card" }, (block) => {
        // @ts-expect-error not a field of card
        block.nope = 1;
      }),
    ]);
  });

  it("should NOT let a block read a field the migration is about to create", () => {
    defineMigration<FixtureSchema>([
      alterBlock({ block: "card" }, (block) => {
        // @ts-expect-error the post-migration field does not exist in the pre-migration schema
        block.price = Number(block.legacy_price);
      }),
    ]);
  });

  it("should keep the block's own typing under an ancestor filter", () => {
    defineMigration<FixtureSchema>([
      alterBlock({ block: "meta", under: "card" }, (block) => {
        expectTypeOf(block.component).toEqualTypeOf<"meta">();
      }),
    ]);
  });
});

describe("alterField() typing", () => {
  it("should type the value as that one field's value", () => {
    defineMigration<FixtureSchema>([
      alterField({ block: "card", field: "description" }, (value, context) => {
        expectTypeOf(value).toEqualTypeOf<string | null | undefined>();
        expectTypeOf(context.language).toEqualTypeOf<string | undefined>();
        expectTypeOf(context.key).toEqualTypeOf<string>();
        return value;
      }),
    ]);
  });

  it("should resolve a bloks field to its child blocks", () => {
    defineMigration<FixtureSchema>([
      alterField({ block: "section", field: "items" }, (value) => {
        expectTypeOf<NonNullable<typeof value>[number]["component"]>().toEqualTypeOf<"card">();
        return value;
      }),
    ]);
  });
});

describe("call shapes", () => {
  it("should accept a bare array", () => {
    defineMigration<FixtureSchema>([removeField({ block: "card", field: "description" })]);
  });

  it("should accept a title alongside the op list", () => {
    defineMigration<AfterRenameMetaAuthor, FixtureSchema>({
      title: "Rename meta.author",
      ops: [renameField({ block: "meta", field: "author", to: "written_by" })],
    });
  });

  it("should reject an inverse authored as a second op list", () => {
    defineMigration<AfterRenameMetaAuthor, FixtureSchema>({
      ops: [renameField({ block: "meta", field: "author", to: "written_by" })],
      // @ts-expect-error there is no `down`: an inverse is recorded or derived, never authored
      down: [renameField({ block: "meta", field: "written_by", to: "author" })],
    });
  });

  it("should compose, because ops are values", () => {
    const BLOCKS = ["card", "article"] as const;
    defineMigration<FixtureSchema>(BLOCKS.map((block) => alterBlock({ block }, () => {})));
  });
});

describe("value typing of a path", () => {
  it("should resolve scalar fields", () => {
    expectTypeOf<ValueOfPath<FixtureSchema, "article.author">>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it("should resolve plugin and structured fields", () => {
    expectTypeOf<ValueOfPath<ProbeFieldTypesSchema, "probe_hero.image">>().toEqualTypeOf<
      AssetFieldValue | null | undefined
    >();
    expectTypeOf<
      MutuallyAssignable<
        NonNullable<ValueOfPath<ProbeFieldTypesSchema, "probe_hero.cta_link">>,
        MultilinkFieldValue
      >
    >().toEqualTypeOf<true>();
    // A registered field plugin narrows the `custom` field to the plugin's value.
    expectTypeOf<
      NonNullable<ValueOfPath<ProbeFieldTypesSchema, "probe_hero.accent_color">>
    >().toEqualTypeOf<{
      color: string;
      plugin: string;
      _uid?: string;
    }>();
  });

  it("should widen an unrestricted bloks field to every nestable block in the schema", () => {
    type Value = ValueOfPath<ProbeFieldTypesSchema, "probe_kitchen_sink.bloks_field">;
    // No `allow`, so the child widens to every *nestable* block in the schema.
    // Root-only blocks are correctly excluded.
    expectTypeOf<NonNullable<Value>[number]["component"]>().toEqualTypeOf<
      "probe_hero" | "probe_kitchen_sink" | "probe_empty"
    >();
  });

  it("should narrow a restricted bloks field to the allowed blocks", () => {
    type Value = ValueOfPath<FixtureSchema, "section.items">;
    expectTypeOf<NonNullable<Value>[number]["component"]>().toEqualTypeOf<"card">();
  });
});

describe("content shape of a block", () => {
  it("should keep a section (UI-only) pseudo field out of the migratable paths", () => {
    // `section` lays out the editor form and holds no value, so addressing it
    // in a migration could never do anything.
    expectTypeOf<
      "probe_kitchen_sink.settings_section" extends FieldPathOf<ProbeFieldTypesSchema>
        ? true
        : false
    >().toEqualTypeOf<false>();
    // It remains a key on the content type — that is `@storyblok/schema`'s
    // `BlockContent`, which the migration DSL does not own.
    expectTypeOf<
      "settings_section" extends keyof ContentOf<ProbeFieldTypesSchema, "probe_kitchen_sink">
        ? true
        : false
    >().toEqualTypeOf<true>();
  });

  it("should give an empty-fields block only the envelope keys", () => {
    expectTypeOf<keyof ContentOf<ProbeFieldTypesSchema, "probe_empty">>().toEqualTypeOf<
      "_uid" | "component" | "_editable"
    >();
  });
});

describe("under on a key op, past the object literal", () => {
  const scoped = { under: "card" } as const;

  it("should reject a spread that carries it", () => {
    defineMigration<AfterRenameMetaAuthor, FixtureSchema>([
      // @ts-expect-error excess-property checking does not fire on a spread, so the key is declared instead
      renameField({ block: "meta", field: "author", to: "written_by", ...scoped }),
    ]);
  });

  it("should reject a hoisted spec", () => {
    const spec = { block: "card", field: "description", under: "section" } as const;
    defineMigration<FixtureSchema>([
      // @ts-expect-error same rule, same error, from a variable rather than a literal
      removeField(spec),
    ]);
  });

  it("should keep accepting a value op built the same way", () => {
    defineMigration<FixtureSchema>([alterBlock({ block: "meta", ...scoped }, () => {})]);
  });
});
