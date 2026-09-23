/**
 * Test fixtures: one migration per case the engine's tests exercise, each
 * written the way a real one would be.
 *
 * A real migration lives in its own file, at
 * `.storyblok/migrations/<space>/NNNN-<name>.ts`. `After` comes first and is the
 * schema module the project already has; `Before` comes from the generated
 * snapshot committed next to the migration (see
 * `0001-rename-article-author.before.ts`). Migrations whose two ends differ only
 * by fields they never read use the single-schema shorthand.
 *
 * `name` is set on each because they share one module here and so have no
 * filename to be keyed by; a real migration takes its id from the filename.
 */
import { defineMigration } from "../define-migration";
import {
  alterBlock,
  alterField,
  coerceField,
  moveField,
  removeField as removeFieldOp,
  renameField as renameFieldOp,
  reorderField,
} from "../ops";
import type { SpikeSchema } from "./schema";
import type {
  AfterCoerceCardTypes,
  AfterRemoveCardDescription,
  AfterRenameArticleAuthor,
  AfterRenameMetaAuthor,
  AfterTwoBlocks,
} from "./schema-after";
import type { Before as ArticleBefore } from "./0001-rename-article-author.before";

/**
 * The two-schema form against a real generated snapshot: the source field comes
 * from `Before`, the rename target from `After`. Neither authoring order
 * compiled when a single schema had to describe both ends.
 */
export const renameField = defineMigration<AfterRenameArticleAuthor, ArticleBefore>({
  name: "0001-rename-article-author",
  ops: [renameFieldOp({ block: "spike_article", field: "author", to: "byline" })],
});

/** Same block name at several depths, under two different parents. */
export const renameNestedField = defineMigration<AfterRenameMetaAuthor, SpikeSchema>({
  name: "0002-rename-meta-author",
  ops: [renameFieldOp({ block: "spike_meta", field: "author", to: "written_by" })],
});

export const removeField = defineMigration<AfterRemoveCardDescription, SpikeSchema>({
  name: "0003-remove-card-description",
  ops: [removeFieldOp({ block: "spike_card", field: "description" })],
});

/**
 * `from` is what makes a coercion invertible without recorded patches. Stating
 * it costs one key and moves the op from tier 3 to tier 2.
 */
export const coerceFields = defineMigration<AfterCoerceCardTypes, SpikeSchema>({
  name: "0004-coerce-card-types",
  ops: [
    coerceField({ block: "spike_card", field: "legacy_price", from: "string", to: "number" }),
    coerceField({ block: "spike_card", field: "featured", from: "string", to: "boolean" }),
  ],
});

/** Single-schema shorthand: `slug` already exists, so `Before` and `After` agree. */
export const moveValue = defineMigration<SpikeSchema>({
  name: "0005-move-old-slug",
  ops: [moveField({ block: "spike_card", field: "old_slug", to: "slug" })],
});

/** The bare-array call shape: no title, nothing but the ops. */
export const alterString = defineMigration<SpikeSchema>([
  alterField({ block: "spike_section", field: "heading" }, (heading) =>
    typeof heading === "string" ? heading.toUpperCase() : heading,
  ),
]);

/** Deliberately non-idempotent: a second pass keeps toggling `meta`. */
export const alterStructure = defineMigration<SpikeSchema>({
  name: "0007-ensure-section-meta",
  ops: [
    alterBlock({ block: "spike_section" }, (block) => {
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
  ],
});

/** One migration file touching two different blocks. */
export const twoBlocks = defineMigration<AfterTwoBlocks, SpikeSchema>({
  name: "0008-two-blocks",
  ops: [
    renameFieldOp({ block: "spike_article", field: "excerpt", to: "summary" }),
    coerceField({ block: "spike_card", field: "title", from: "string", to: "string" }),
    alterBlock({ block: "spike_card" }, (block) => {
      block.slug = String(block.title ?? "")
        .toLowerCase()
        .replace(/\s+/g, "-");
    }),
  ],
});

/** Targets a block defined in the schema but present in no story. */
export const noMatches = defineMigration<SpikeSchema>({
  name: "0009-no-matches",
  ops: [removeFieldOp({ block: "spike_banner", field: "label" })],
});

/**
 * Scoped to one location: only the `spike_meta` instances with a `spike_card`
 * anywhere above them. A value op, so the schema does not move and a subset is
 * coherent — the same `under` on a key op is a type error.
 */
export const scopedAlter = defineMigration<SpikeSchema>({
  name: "0010-scoped-meta-og-title",
  ops: [
    alterField({ block: "spike_meta", field: "og_title", under: "spike_card" }, (title) =>
      typeof title === "string" && !title.startsWith("card:") ? `card:${title}` : title,
    ),
  ],
});

/** Explicit reorder, so ordering does not degrade to a whole-array replace. */
export const reorderItems = defineMigration<SpikeSchema>({
  name: "0011-sort-section-items",
  ops: [
    reorderField({ block: "spike_section", field: "items" }, (a, b) =>
      String(b.title ?? "").localeCompare(String(a.title ?? "")),
    ),
  ],
});

/**
 * Two ancestor constraints: a `spike_meta` inside a `spike_card` that is itself
 * inside a `spike_section`. Read outermost first; each name has to appear above
 * the next, with gaps allowed at every step.
 */
export const nestedUnder = defineMigration<SpikeSchema>({
  name: "0012-meta-in-card-in-section",
  ops: [
    alterField(
      { block: "spike_meta", field: "og_title", under: ["spike_section", "spike_card"] },
      (title) => (typeof title === "string" ? `deep:${title}` : title),
    ),
  ],
});

/** The same two names in the wrong order, which must match nothing. */
export const nestedUnderReversed = defineMigration<SpikeSchema>({
  name: "0013-order-matters",
  ops: [
    alterField(
      { block: "spike_meta", field: "og_title", under: ["spike_card", "spike_section"] },
      (title) => (typeof title === "string" ? `wrong:${title}` : title),
    ),
  ],
});

/** The object call shape: the op list plus a `title` for CLI output. */
export const titledRename = defineMigration<AfterRenameMetaAuthor, SpikeSchema>({
  name: "0014-titled-rename",
  title: "Rename spike_meta.author to written_by",
  ops: [renameFieldOp({ block: "spike_meta", field: "author", to: "written_by" })],
});
