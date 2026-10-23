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
import type { FixtureSchema } from "./schema";
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
 * from `Before`, the rename target from `After`.
 */
export const renameField = defineMigration<AfterRenameArticleAuthor, ArticleBefore>({
  ops: [renameFieldOp({ block: "article", field: "author", to: "byline" })],
});

/** Same block name at several depths, under two different parents. */
export const renameNestedField = defineMigration<AfterRenameMetaAuthor, FixtureSchema>({
  ops: [renameFieldOp({ block: "meta", field: "author", to: "written_by" })],
});

export const removeField = defineMigration<AfterRemoveCardDescription, FixtureSchema>({
  ops: [removeFieldOp({ block: "card", field: "description" })],
});

/**
 * `from` is what makes a coercion invertible without recorded patches.
 */
export const coerceFields = defineMigration<AfterCoerceCardTypes, FixtureSchema>({
  ops: [
    coerceField({ block: "card", field: "legacy_price", from: "string", to: "number" }),
    coerceField({ block: "card", field: "featured", from: "string", to: "boolean" }),
  ],
});

/** Single-schema shorthand: `slug` already exists, so `Before` and `After` agree. */
export const moveValue = defineMigration<FixtureSchema>({
  ops: [moveField({ block: "card", field: "old_slug", to: "slug" })],
});

/** The bare-array call shape: no title, nothing but the ops. */
export const alterString = defineMigration<FixtureSchema>([
  alterField({ block: "section", field: "heading" }, (heading) =>
    typeof heading === "string" ? heading.toUpperCase() : heading,
  ),
]);

/** Deliberately non-idempotent: a second pass keeps toggling `meta`. */
export const alterStructure = defineMigration<FixtureSchema>({
  ops: [
    alterBlock({ block: "section" }, (block) => {
      const meta = block.meta ?? [];
      if (meta.length === 0) {
        block.meta = [
          {
            _uid: `added-${block._uid}`,
            component: "meta",
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
export const twoBlocks = defineMigration<AfterTwoBlocks, FixtureSchema>({
  ops: [
    renameFieldOp({ block: "article", field: "excerpt", to: "summary" }),
    coerceField({ block: "card", field: "title", from: "string", to: "string" }),
    alterBlock({ block: "card" }, (block) => {
      block.slug = String(block.title ?? "")
        .toLowerCase()
        .replace(/\s+/g, "-");
    }),
  ],
});

/** Targets a block defined in the schema but present in no story. */
export const noMatches = defineMigration<FixtureSchema>({
  ops: [removeFieldOp({ block: "banner", field: "label" })],
});

/**
 * Scoped to one location: only the `meta` instances with a `card`
 * anywhere above them. A value op, so the schema does not move and a subset is
 * coherent — the same `under` on a key op is a type error.
 */
export const scopedAlter = defineMigration<FixtureSchema>({
  ops: [
    alterField({ block: "meta", field: "og_title", under: "card" }, (title) =>
      typeof title === "string" && !title.startsWith("card:") ? `card:${title}` : title,
    ),
  ],
});

/** Explicit reorder, so ordering does not degrade to a whole-array replace. */
export const reorderItems = defineMigration<FixtureSchema>({
  ops: [
    reorderField({ block: "section", field: "items" }, (a, b) =>
      String(b.title ?? "").localeCompare(String(a.title ?? "")),
    ),
  ],
});

/**
 * Two ancestor constraints: a `meta` inside a `card` that is itself
 * inside a `section`. Read outermost first; each name has to appear above
 * the next, with gaps allowed at every step.
 */
export const nestedUnder = defineMigration<FixtureSchema>({
  ops: [
    alterField({ block: "meta", field: "og_title", under: ["section", "card"] }, (title) =>
      typeof title === "string" ? `deep:${title}` : title,
    ),
  ],
});

/** The same two names in the wrong order, which must match nothing. */
export const nestedUnderReversed = defineMigration<FixtureSchema>({
  ops: [
    alterField({ block: "meta", field: "og_title", under: ["card", "section"] }, (title) =>
      typeof title === "string" ? `wrong:${title}` : title,
    ),
  ],
});

/** The object call shape: the op list plus a `title` for CLI output. */
export const titledRename = defineMigration<AfterRenameMetaAuthor, FixtureSchema>({
  title: "Rename meta.author to written_by",
  ops: [renameFieldOp({ block: "meta", field: "author", to: "written_by" })],
});
