/**
 * SPIKE — the probe migrations, one per use case under test.
 *
 * Each entry is what the proposed DSL would put in
 * `.storyblok/migrations/<space>/NNNN-<name>.ts`.
 */
import { defineMigration } from "../src/define-migration";
import type { SpikeSchema } from "../fixtures/schema";

export const renameField = defineMigration<SpikeSchema>({
  name: "0001-rename-article-author",
  up: (m) => m.field("spike_article.author").renameTo("byline"),
});

/** Same block name at several depths, under two different parents. */
export const renameNestedField = defineMigration<SpikeSchema>({
  name: "0002-rename-meta-author",
  up: (m) => m.field("spike_meta.author").renameTo("written_by"),
});

export const removeField = defineMigration<SpikeSchema>({
  name: "0003-remove-card-description",
  up: (m) => m.field("spike_card.description").remove(),
});

export const coerceFields = defineMigration<SpikeSchema>({
  name: "0004-coerce-card-types",
  up: (m) => {
    m.field("spike_card.legacy_price").asNumber();
    m.field("spike_card.featured").asBoolean();
  },
});

export const moveValue = defineMigration<SpikeSchema>({
  name: "0005-move-old-slug",
  up: (m) => m.field("spike_card.old_slug").moveTo("slug"),
});

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
export const twoBlocks = defineMigration<SpikeSchema>({
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
  up: (m) => m.field("spike_banner.label").renameTo("caption"),
});
