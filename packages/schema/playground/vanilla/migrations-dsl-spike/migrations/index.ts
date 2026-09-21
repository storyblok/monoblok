/**
 * SPIKE — the probe migrations, one per use case under test.
 *
 * Each entry is what the proposed DSL would put in
 * `.storyblok/migrations/<space>/NNNN-<name>.ts`. `Before` comes from the
 * generated snapshot committed next to the migration (see
 * `0001-rename-article-author.before.ts`); `After` is the project's live schema
 * module. Migrations whose two ends differ only by fields they never read use
 * the single-schema shorthand.
 *
 * `name` exists here only because these probes share one module and so have no
 * filename to be keyed by; shipped migrations take their id from the filename.
 */
import { defineMigration } from "../src/define-migration";
import type { SpikeSchema } from "../fixtures/schema";
import type {
  AfterCoerceCardTypes,
  AfterRemoveCardDescription,
  AfterRenameArticleAuthor,
  AfterRenameMetaAuthor,
  AfterTwoBlocks,
} from "../fixtures/schema-after";
import type { Before as ArticleBefore } from "./0001-rename-article-author.before";

/**
 * The two-schema form against a real generated snapshot: the path comes from
 * `Before`, the rename target from `After`. Neither authoring order compiled
 * when a single schema had to describe both ends.
 */
export const renameField = defineMigration<ArticleBefore, AfterRenameArticleAuthor>({
  name: "0001-rename-article-author",
  up: (m) => m.field("spike_article.author").renameTo("byline"),
});

/** Same block name at several depths, under two different parents. */
export const renameNestedField = defineMigration<SpikeSchema, AfterRenameMetaAuthor>({
  name: "0002-rename-meta-author",
  up: (m) => m.field("spike_meta.author").renameTo("written_by"),
});

export const removeField = defineMigration<SpikeSchema, AfterRemoveCardDescription>({
  name: "0003-remove-card-description",
  up: (m) => m.field("spike_card.description").remove(),
});

export const coerceFields = defineMigration<SpikeSchema, AfterCoerceCardTypes>({
  name: "0004-coerce-card-types",
  up: (m) => {
    m.field("spike_card.legacy_price").asNumber();
    m.field("spike_card.featured").asBoolean();
  },
});

/** Single-schema shorthand: `slug` already exists, so `Before` and `After` agree. */
export const moveValue = defineMigration<SpikeSchema>({
  name: "0005-move-old-slug",
  up: (m) => m.field("spike_card.old_slug").moveTo("slug"),
});

/** Single-schema shorthand: an `alter` that only rewrites a value. */
export const alterString = defineMigration<SpikeSchema>({
  name: "0006-uppercase-headings",
  up: (m) =>
    m.block("spike_section").alter((block) => {
      if (typeof block.heading === "string") {
        block.heading = block.heading.toUpperCase();
      }
    }),
});

export const alterStructure = defineMigration<SpikeSchema>({
  name: "0007-ensure-section-meta",
  up: (m) =>
    m.block("spike_section").alter((block) => {
      const meta = block.meta ?? [];
      if (meta.length === 0) {
        block.meta = [
          {
            _uid: `spike-added-${block._uid}`,
            component: "spike_meta",
            og_title: block.heading ?? "",
          },
        ];
      } else {
        block.meta = [];
      }
    }),
});

/** One migration file touching two different blocks. */
export const twoBlocks = defineMigration<SpikeSchema, AfterTwoBlocks>({
  name: "0008-two-blocks",
  up: (m) => {
    m.field("spike_article.excerpt").renameTo("summary");
    m.field("spike_card.title").asString();
    m.block("spike_card").alter((block) => {
      block.slug = String(block.title ?? "")
        .toLowerCase()
        .replace(/\s+/g, "-");
    });
  },
});

/** Targets a block defined in the schema but present in no story. */
export const noMatches = defineMigration<SpikeSchema>({
  name: "0009-no-matches",
  up: (m) => m.field("spike_banner.label").remove(),
});

/** Scoped to one location: only the `spike_meta` instances inside a `spike_card`. */
export const scopedRename = defineMigration<SpikeSchema>({
  name: "0010-scoped-meta-og-title",
  up: (m) =>
    m
      .block("spike_meta")
      .under("spike_card")
      .alter((block) => {
        block.og_title = `card:${block.og_title ?? ""}`;
      }),
});

/** Explicit reorder, so ordering does not degrade to a whole-array replace. */
export const reorderItems = defineMigration<SpikeSchema>({
  name: "0011-sort-section-items",
  up: (m) =>
    m
      .field("spike_section.items")
      .reorder((a, b) => String(b.title ?? "").localeCompare(String(a.title ?? ""))),
});
