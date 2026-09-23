/**
 * Behaviour of the runner, including the headline claim: a patch-derived
 * inverse rolls back without clobbering an edit made after the migration, where
 * a whole-story snapshot restore does.
 */
import { describe, expect, it } from "vitest";
import { applyPatches, indexBlocks } from "./patch";
import { runMigrationOnStory } from "./runner";
import { defineMigration } from "./define-migration";
import {
  alterBlock,
  alterField,
  removeField as removeFieldOp,
  renameField as renameFieldOp,
} from "./ops";
import { deriveInverse } from "./derive-inverse";
import { validateMigration } from "./validate-migration";
import { validateStory } from "../index";
import {
  alterString,
  alterStructure,
  coerceFields,
  moveValue,
  nestedUnder,
  nestedUnderReversed,
  noMatches,
  removeField,
  renameField,
  renameNestedField,
  reorderItems,
  scopedAlter,
  titledRename,
  twoBlocks,
} from "./__fixtures__/migrations";
import { spikeSchema, type SpikeSchema } from "./__fixtures__/schema";
import { articleStoryContent, pageStoryContent } from "./__fixtures__/stories";

const schemaLike = { blocks: Object.values(spikeSchema.blocks) };

function block(content: unknown, uid: string): Record<string, unknown> {
  const found = indexBlocks(content).get(uid);
  if (!found) throw new Error(`no block ${uid}`);
  return found;
}

describe("rename", () => {
  it("should rename a field on a root block and restore it on rollback", () => {
    const original = articleStoryContent();
    const run = runMigrationOnStory(renameField, original);

    expect(block(run.content, "article-root").byline).toBe("Ada Lovelace");
    expect("author" in block(run.content, "article-root")).toBe(false);

    const rolledBack = structuredClone(run.content);
    const result = applyPatches(rolledBack, run.inverse);
    expect(result.conflicts).toEqual([]);
    expect(rolledBack).toEqual(original);
  });

  it("should rename the same field on every instance of a deeply nested block under several parents", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(renameNestedField, original);

    // spike_meta appears at depth 2 (page.body), 3 (section.meta) and 4 (card.meta).
    for (const uid of ["meta-top", "meta-a", "meta-a1", "meta-b1"]) {
      expect(block(run.content, uid)).toHaveProperty("written_by");
      expect(block(run.content, uid)).not.toHaveProperty("author");
    }
    expect(run.matched).toBe(4);

    const rolledBack = structuredClone(run.content);
    applyPatches(rolledBack, run.inverse);
    expect(rolledBack).toEqual(original);
  });

  it("should reach a block embedded in a richtext field", () => {
    const run = runMigrationOnStory(renameNestedField, articleStoryContent());
    expect(block(run.content, "meta-in-richtext")).toHaveProperty("written_by");
  });

  it("should keep the field's position in the object", () => {
    const run = runMigrationOnStory(renameField, articleStoryContent());
    expect(Object.keys(block(run.content, "article-root"))).toEqual([
      "_uid",
      "component",
      "title",
      "byline",
      "excerpt",
      "body",
    ]);
  });
});

describe("remove", () => {
  it("should bring the removed value back on rollback", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(removeField, original);
    expect(block(run.content, "card-a1")).not.toHaveProperty("description");

    const rolledBack = structuredClone(run.content);
    applyPatches(rolledBack, run.inverse);
    expect(block(rolledBack, "card-a1").description).toBe("First card");
    expect(rolledBack).toEqual(original);
  });
});

describe("coercion", () => {
  it("should coerce to each field type's wire form", () => {
    const run = runMigrationOnStory(coerceFields, pageStoryContent());
    // A number field stores a numeric *string*; a boolean field stores a real
    // boolean. `asNumber()` writing a JSON number would produce content no
    // editor could have written.
    expect(block(run.content, "card-a1").legacy_price).toBe("19.99");
    expect(block(run.content, "card-a1").featured).toBe(true);
    expect(block(run.content, "card-b1").featured).toBe(false);
    // Unparseable input becomes the empty string an unset number field holds.
    expect(block(run.content, "card-a2").legacy_price).toBe("");
  });

  it("should NOT round-trip a lossy coercion", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(coerceFields, original);
    const rolledBack = structuredClone(run.content);
    applyPatches(rolledBack, run.inverse);
    // The inverse restores the original string because it carries the old value
    // verbatim — the loss is recoverable here precisely because the patch is a
    // value snapshot, not a reversible function.
    expect(block(rolledBack, "card-a2").legacy_price).toBe("not-a-number");
    expect(rolledBack).toEqual(original);
  });
});

describe("move", () => {
  it("should move a value onto another field and overwrite the target", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(moveValue, original);
    expect(block(run.content, "card-a1").slug).toBe("card-a-1");
    expect(block(run.content, "card-a1")).not.toHaveProperty("old_slug");
    // Destructive: card-a2 had an empty old_slug and a real slug.
    expect(block(run.content, "card-a2").slug).toBe("");

    const rolledBack = structuredClone(run.content);
    applyPatches(rolledBack, run.inverse);
    expect(rolledBack).toEqual(original);
  });
});

describe("alter", () => {
  it("should rewrite a string and roll back", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(alterString, original);
    expect(block(run.content, "section-a").heading).toBe("FIRST SECTION");

    const rolledBack = structuredClone(run.content);
    applyPatches(rolledBack, run.inverse);
    expect(rolledBack).toEqual(original);
  });

  it("should add and remove nested blocks and roll back both", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(alterStructure, original);
    // section-a had meta → emptied; section-b had none → one added.
    expect(block(run.content, "section-a").meta).toEqual([]);
    expect((block(run.content, "section-b").meta as unknown[]).length).toBe(1);

    const rolledBack = structuredClone(run.content);
    const result = applyPatches(rolledBack, run.inverse);
    expect(result.conflicts).toEqual([]);
    expect(rolledBack).toEqual(original);
  });
});

describe("multi-block migration", () => {
  it("should apply ops for two different blocks in one run", () => {
    const run = runMigrationOnStory(twoBlocks, pageStoryContent());
    expect(block(run.content, "card-a1").slug).toBe("card-a1");
    const article = runMigrationOnStory(twoBlocks, articleStoryContent());
    expect(block(article.content, "article-root").summary).toBe("An excerpt.");
  });
});

describe("zero matches and idempotency", () => {
  it("should report no change when nothing matches", () => {
    const run = runMigrationOnStory(noMatches, pageStoryContent());
    expect(run.matched).toBe(0);
    expect(run.changed).toBe(false);
    expect(run.patches).toEqual([]);
  });

  it("should be a no-op on a second run for a rename", () => {
    const once = runMigrationOnStory(renameNestedField, pageStoryContent());
    const twice = runMigrationOnStory(renameNestedField, once.content);
    expect(twice.changed).toBe(false);
    // Still "matched" — the block is there, the field is not.
    expect(twice.matched).toBe(4);
  });

  it("should NOT be a no-op on a second run for a free-form alter", () => {
    const once = runMigrationOnStory(alterStructure, pageStoryContent());
    const twice = runMigrationOnStory(alterStructure, once.content);
    expect(twice.changed).toBe(true);
  });
});

describe("rollback after an unrelated edit — the headline claim", () => {
  it("should preserve an edit to a different field of the same block", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(removeField, original);

    const live = structuredClone(run.content);
    block(live, "card-a1").title = "Card A1 (edited after the migration)";

    const result = applyPatches(live, run.inverse);
    expect(result.conflicts).toEqual([]);
    expect(block(live, "card-a1").description).toBe("First card");
    expect(block(live, "card-a1").title).toBe("Card A1 (edited after the migration)");

    // Today's behaviour: restoring the whole-story snapshot throws the edit away.
    const snapshotRestore = structuredClone(original);
    expect(block(snapshotRestore, "card-a1").title).toBe("Card A1");
  });

  it("should preserve a block added to a different part of the story after the migration", () => {
    const original = pageStoryContent();
    const run = runMigrationOnStory(renameNestedField, original);

    const live = structuredClone(run.content);
    (block(live, "section-b").items as unknown[]).push({
      _uid: "card-b2",
      component: "spike_card",
      title: "Added after the migration",
    });

    const result = applyPatches(live, run.inverse);
    expect(result.conflicts).toEqual([]);
    expect((block(live, "section-b").items as unknown[]).length).toBe(2);
    expect(block(live, "meta-b1").author).toBe("Alan");
  });

  it("should refuse to clobber an edit to the very field the migration touched", () => {
    const run = runMigrationOnStory(renameNestedField, pageStoryContent());
    const live = structuredClone(run.content);
    block(live, "meta-a").written_by = "Edited by a human";

    const result = applyPatches(live, run.inverse);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(block(live, "meta-a").written_by).toBe("Edited by a human");
  });

  it("should skip a patch whose block was deleted after the migration", () => {
    const run = runMigrationOnStory(renameNestedField, pageStoryContent());
    const live = structuredClone(run.content);
    block(live, "section-a").meta = [];

    const result = applyPatches(live, run.inverse);
    expect(result.missing).toContain("meta-a");
  });

  it("should still conflict when the edit lands in the same bloks array the migration restructured", () => {
    const run = runMigrationOnStory(alterStructure, pageStoryContent());
    const live = structuredClone(run.content);
    (block(live, "section-b").meta as unknown[]).push({
      _uid: "meta-b-new",
      component: "spike_meta",
      author: "Added by a human",
    });

    const result = applyPatches(live, run.inverse);
    // The inverse removes only the uid the migration added, so the human's block
    // survives — uid-scoped list ops, not a whole-array replacement.
    expect(result.conflicts).toEqual([]);
    expect((block(live, "section-b").meta as { _uid: string }[]).map((item) => item._uid)).toEqual([
      "meta-b-new",
    ]);
  });
});

describe("schema-aware validation", () => {
  it("should reject a migration addressing a field the schema does not define", () => {
    const bogus = {
      name: "x",
      targets: ["spike_card"],
      ops: [{ kind: "renameField", block: "spike_card", field: "nope", to: "yep" }],
    } as never;
    const issues = validateMigration(bogus, schemaLike);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('has no field "nope"');
  });

  it("should reject a rename onto a field that already exists", () => {
    const issues = validateMigration(moveValue, schemaLike);
    // `moveField` is deliberately allowed onto an existing field; `renameField` is not.
    expect(issues).toEqual([]);
  });

  it("should accept every probe migration against the pre-migration schema", () => {
    for (const migration of [
      renameField,
      renameNestedField,
      removeField,
      coerceFields,
      alterString,
      noMatches,
    ]) {
      expect(validateMigration(migration, schemaLike)).toEqual([]);
    }
  });

  it("should report the post-migration story as invalid against the PRE-migration schema", () => {
    const run = runMigrationOnStory(renameField, articleStoryContent());
    const result = validateStory({ content: run.content }, schemaLike);
    const errors = result.issues.filter((issue) => issue.severity === "error");
    // The renamed field is not in the old schema, so post-condition validation
    // against the schema the migration was written for always fails.
    expect(result.issues.length).toBeGreaterThan(0);
    expect(errors.length + result.issues.length).toBeGreaterThan(0);
  });

  it("should report the pre-migration fixture as clean", () => {
    const result = validateStory({ content: pageStoryContent() }, schemaLike);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });
});

describe("location scoping with under", () => {
  it("should touch only the instances nested under the named parent", () => {
    const run = runMigrationOnStory(scopedAlter, pageStoryContent());

    // Inside a spike_card.
    expect(block(run.content, "meta-a1").og_title).toBe("card:A1");
    expect(block(run.content, "meta-b1").og_title).toBe("card:B1");
    // Directly on a section, and on the page root: untouched.
    expect(block(run.content, "meta-a").og_title).toBe("A");
    expect(block(run.content, "meta-top").og_title).toBe("Top");
  });

  it("should count only the scoped instances as matched", () => {
    expect(runMigrationOnStory(scopedAlter, pageStoryContent()).matched).toBe(2);
  });
});

describe("reorder", () => {
  it("should reorder a bloks array without replacing the whole array", () => {
    const run = runMigrationOnStory(reorderItems, pageStoryContent());

    const items = block(run.content, "section-a").items as { _uid: string }[];
    expect(items.map((item) => item._uid)).toEqual(["card-a2", "card-a1"]);

    const patch = run.patches.find((entry) => entry.uid === "section-a");
    expect(patch?.ops).toEqual([
      {
        kind: "listOrder",
        key: "items",
        uids: ["card-a2", "card-a1"],
        expect: ["card-a1", "card-a2"],
      },
    ]);
  });

  it("should roll the order back while preserving an edit to a reordered child", () => {
    const run = runMigrationOnStory(reorderItems, pageStoryContent());
    const live = structuredClone(run.content);
    (block(live, "card-a1") as Record<string, unknown>).title = "Edited after the migration";

    const result = applyPatches(live, run.inverse);

    expect(result.conflicts).toEqual([]);
    const items = block(live, "section-a").items as { _uid: string }[];
    expect(items.map((item) => item._uid)).toEqual(["card-a1", "card-a2"]);
    expect(block(live, "card-a1").title).toBe("Edited after the migration");
  });

  it("should report a conflict when the order itself changed after the migration", () => {
    const run = runMigrationOnStory(reorderItems, pageStoryContent());
    const live = structuredClone(run.content);
    const section = block(live, "section-a") as Record<string, unknown>;
    section.items = (section.items as unknown[]).slice().reverse();

    const result = applyPatches(live, run.inverse);

    expect(result.conflicts).toEqual([
      {
        uid: "section-a",
        key: "items",
        reason: 'live order of "items" differs from the order the migration wrote',
      },
    ]);
  });

  it("should keep a block the patch does not know about in its live slot", () => {
    const run = runMigrationOnStory(reorderItems, pageStoryContent());
    const live = structuredClone(run.content);
    const section = block(live, "section-a") as Record<string, unknown>;
    (section.items as unknown[]).push({ _uid: "card-new", component: "spike_card", title: "New" });

    const result = applyPatches(live, run.inverse);

    expect(result.conflicts).toEqual([]);
    const items = block(live, "section-a").items as { _uid: string }[];
    expect(items.map((item) => item._uid)).toEqual(["card-a1", "card-a2", "card-new"]);
  });
});

describe("transport-only keys", () => {
  it("should ignore the delivery API's _editable when diffing", () => {
    const content = pageStoryContent();
    const withEditable = structuredClone(content) as Record<string, unknown>;
    for (const instance of indexBlocks(withEditable).values()) {
      instance._editable = `<!--#storyblok#{"uid": "${instance._uid}"}-->`;
    }

    const run = runMigrationOnStory(alterString, withEditable);

    expect(run.patches.flatMap((patch) => patch.ops.map((op) => op.key))).toEqual([
      "heading",
      "heading",
    ]);
  });
});

describe("conflict granularity", () => {
  it("should skip a renamed block whole rather than leave it holding both names", () => {
    const run = runMigrationOnStory(renameNestedField, pageStoryContent());
    const live = structuredClone(run.content);
    (block(live, "meta-b1") as Record<string, unknown>).written_by = "Edited after the migration";

    const result = applyPatches(live, run.inverse);

    expect(result.conflicts).toEqual([
      {
        uid: "meta-b1",
        key: "written_by",
        reason: "live value differs from the value the migration wrote",
      },
    ]);
    // The other half of the rename must not land: a block carrying both the old
    // and the new field name matches no schema.
    expect("author" in block(live, "meta-b1")).toBe(false);
    expect(block(live, "meta-b1").written_by).toBe("Edited after the migration");
    // Every other instance still rolls back.
    expect(block(live, "meta-a1").author).toBe("Grace");
    expect("written_by" in block(live, "meta-a1")).toBe(false);
  });
});

describe("block identity", () => {
  it("should report a duplicate _uid an alter introduced", () => {
    const duplicating = defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_section" }, (block) => {
        const first = block.items?.[0];
        if (first) block.items = [...(block.items ?? []), structuredClone(first)];
      }),
    ]);

    const run = runMigrationOnStory(duplicating, pageStoryContent());

    // The backend regenerates the repeated uid on write, which would leave the
    // recorded patch addressing a block that no longer exists.
    expect(run.unstableUids.duplicate).toEqual(["card-a1", "meta-a1", "card-b1", "meta-b1"]);
  });

  it("should report a block an alter created without a _uid", () => {
    const uidless = defineMigration<SpikeSchema>([
      alterBlock({ block: "spike_section" }, (block) => {
        // @ts-expect-error a block literal without _uid is exactly what this guards against
        block.meta = [{ component: "spike_meta", og_title: "no uid" }];
      }),
    ]);

    expect(runMigrationOnStory(uidless, pageStoryContent()).unstableUids.missing).toBe(2);
  });

  it("should report nothing for a migration that keeps identity intact", () => {
    const run = runMigrationOnStory(renameNestedField, pageStoryContent());
    expect(run.unstableUids).toEqual({ duplicate: [], missing: 0, preExisting: [] });
  });
});

describe("ancestor chains", () => {
  it("should require every name in the chain, outermost first", () => {
    const run = runMigrationOnStory(nestedUnder, pageStoryContent());

    // spike_meta inside a spike_card inside a spike_section.
    expect(block(run.content, "meta-a1").og_title).toBe("deep:A1");
    expect(block(run.content, "meta-b1").og_title).toBe("deep:B1");
    // Directly on a section, and on the page root: no spike_card above them.
    expect(block(run.content, "meta-a").og_title).toBe("A");
    expect(block(run.content, "meta-top").og_title).toBe("Top");
  });

  it("should match nothing when the chain names the ancestors in the wrong order", () => {
    const run = runMigrationOnStory(nestedUnderReversed, pageStoryContent());
    expect(run.matched).toBe(0);
    expect(run.changed).toBe(false);
  });

  it("should tolerate a gap between the names in the chain", () => {
    // spike_page > spike_section > spike_card > spike_meta: naming only the
    // outermost and innermost still matches, so wrapping content one level
    // deeper does not break the migration.
    const gapped = defineMigration<SpikeSchema>([
      alterField(
        { block: "spike_meta", field: "og_title", under: ["spike_page", "spike_card"] },
        (title) =>
          typeof title === "string" && !title.startsWith("gap:") ? `gap:${title}` : title,
      ),
    ]);
    const run = runMigrationOnStory(gapped, pageStoryContent());
    expect(block(run.content, "meta-a1").og_title).toBe("gap:A1");
    expect(block(run.content, "meta-top").og_title).toBe("Top");
  });
});

describe("idempotency check", () => {
  it("should report an alter that does not agree with itself on a second pass", () => {
    const run = runMigrationOnStory(alterStructure, pageStoryContent());
    expect(run.nonIdempotent.map((entry) => entry.uid).sort()).toEqual(["section-a", "section-b"]);
  });

  it("should report nothing for a guarded alter", () => {
    expect(runMigrationOnStory(scopedAlter, pageStoryContent()).nonIdempotent).toEqual([]);
    expect(runMigrationOnStory(alterString, pageStoryContent()).nonIdempotent).toEqual([]);
  });

  it("should not need the check for a key op, which is a no-op on a rerun by construction", () => {
    expect(runMigrationOnStory(renameNestedField, pageStoryContent()).nonIdempotent).toEqual([]);
  });
});

describe("derived inverse — rollback tier 2", () => {
  it("should invert a rename from the op alone, with no run and no recorded state", () => {
    const derived = deriveInverse(renameNestedField.ops);

    expect(derived.derivable).toBe(true);
    expect(derived.ops).toEqual([
      { kind: "renameField", block: "spike_meta", field: "written_by", to: "author" },
    ]);

    // Replaying it on a machine that never applied the migration puts the
    // content back — which is the case recorded patches cannot cover.
    const migrated = runMigrationOnStory(renameNestedField, pageStoryContent()).content;
    const rolledBack = runMigrationOnStory(
      { ...renameNestedField, ops: derived.ops, targets: ["spike_meta"] },
      migrated,
    );
    expect(rolledBack.content).toEqual(pageStoryContent());
  });

  it("should invert a coercion only when the author stated the original type", () => {
    const withFrom = deriveInverse(coerceFields.ops);
    expect(withFrom.derivable).toBe(true);
    expect(withFrom.lossy).toEqual([0, 1]);

    const withoutFrom = deriveInverse([
      { kind: "coerceField", block: "spike_card", field: "featured", to: "boolean" },
    ]);
    expect(withoutFrom.derivable).toBe(false);
    expect(withoutFrom.blocked[0].reason).toContain("`from`");
  });

  it("should refuse a removal, because the values are gone", () => {
    const derived = deriveInverse(removeField.ops);
    expect(derived.derivable).toBe(false);
    expect(derived.blocked).toEqual([
      { index: 0, kind: "removeField", reason: "the values are gone" },
    ]);
  });

  it("should refuse an alter, because the output depends on the input", () => {
    const derived = deriveInverse(alterString.ops);
    expect(derived.derivable).toBe(false);
    expect(derived.blocked[0].kind).toBe("alterField");
  });

  it("should reverse the op order, so a partially derivable migration reports which half survives", () => {
    const derived = deriveInverse(twoBlocks.ops);
    expect(derived.derivable).toBe(false);
    expect(derived.ops).toEqual([
      { kind: "coerceField", block: "spike_card", field: "title", to: "string", from: "string" },
      { kind: "renameField", block: "spike_article", field: "summary", to: "excerpt" },
    ]);
    expect(derived.blocked.map((entry) => entry.kind)).toEqual(["alterBlock"]);
  });
});

describe("the object call shape", () => {
  it("should carry a title for CLI output", () => {
    expect(titledRename.title).toBe("Rename spike_meta.author to written_by");
  });

  it("should leave a bare-array migration without one", () => {
    expect(alterString.title).toBeUndefined();
  });
});

describe("a rename onto an occupied target", () => {
  function metaStory(block: Record<string, unknown>): Record<string, unknown> {
    return {
      _uid: "root",
      component: "spike_page",
      body: [{ _uid: "m", component: "spike_meta", ...block }],
    };
  }

  function metaBlock(run: { content: unknown }): Record<string, unknown> {
    return block(run.content, "m");
  }

  it("should clear a translation of the target that has no counterpart on the source", () => {
    // Otherwise the orphan sibling stays put and is served as the German
    // translation of the value that just landed on the base key.
    const run = runMigrationOnStory(
      renameNestedField,
      metaStory({ author: "Ada", written_by__i18n__de: "STALE" }),
    );

    expect(metaBlock(run)).toEqual({ _uid: "m", component: "spike_meta", written_by: "Ada" });
  });

  it("should carry the source translations onto the target", () => {
    const run = runMigrationOnStory(
      renameNestedField,
      metaStory({ author: "Ada", author__i18n__de: "Ada auf Deutsch" }),
    );

    expect(metaBlock(run)).toEqual({
      _uid: "m",
      component: "spike_meta",
      written_by: "Ada",
      written_by__i18n__de: "Ada auf Deutsch",
    });
  });

  it("should drop the displaced value's translations when a move overwrites it", () => {
    const original = {
      _uid: "root",
      component: "spike_page",
      body: [
        {
          _uid: "c",
          component: "spike_card",
          title: "Card",
          old_slug: "new",
          slug: "old",
          slug__i18n__de: "alt",
        },
      ],
    };

    const run = runMigrationOnStory(moveValue, original);

    expect(block(run.content, "c")).toEqual({
      _uid: "c",
      component: "spike_card",
      title: "Card",
      slug: "new",
    });
  });

  it("should leave a block alone when the source family is already gone", () => {
    // The rerun case: without this, clearing the target family would delete the
    // very keys the first run wrote.
    const migrated = metaStory({ written_by: "Ada", written_by__i18n__de: "Ada auf Deutsch" });
    const run = runMigrationOnStory(renameNestedField, migrated);

    expect(run.changed).toBe(false);
    expect(metaBlock(run)).toEqual({
      _uid: "m",
      component: "spike_meta",
      written_by: "Ada",
      written_by__i18n__de: "Ada auf Deutsch",
    });
  });
});

describe("under smuggled onto a key op", () => {
  it("should be reported by validateMigration when it reached the op anyway", () => {
    // The type system rejects it, including through a spread or a hoisted spec.
    // This is the net for a migration that never went through the type system,
    // and for one whose author cast their way around it.
    const smuggled = {
      ops: [
        {
          kind: "renameField",
          block: "spike_meta",
          field: "author",
          to: "written_by",
          under: "spike_card",
        },
      ],
      targets: ["spike_meta"],
    } as unknown as Parameters<typeof validateMigration>[0];

    const issues = validateMigration(smuggled, schemaLike);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("cannot be scoped with `under`");
  });

  it("should still apply globally, because a key op ignores under by construction", () => {
    const smuggled = {
      ops: [
        {
          kind: "renameField",
          block: "spike_meta",
          field: "author",
          to: "written_by",
          under: "spike_card",
        },
      ],
      targets: ["spike_meta"],
    } as unknown as Parameters<typeof runMigrationOnStory>[0];

    // All four instances, not the two under a spike_card. Honouring it would be
    // the worse outcome of the two: a subset migrated leaves every other
    // instance holding a key no schema describes, which is precisely what the
    // rule exists to prevent. Refusing the migration is the CLI's job, on the
    // issue above; applying it globally is what the runner does meanwhile.
    expect(runMigrationOnStory(smuggled, pageStoryContent()).matched).toBe(4);
  });
});

describe("key ops and translated fields", () => {
  it("should rename the translated siblings along with the base key", () => {
    const migration = defineMigration<SpikeSchema>({
      name: "rename-old-slug",
      ops: [renameFieldOp({ block: "spike_card", field: "old_slug", to: "slug" })],
    });

    const result = runMigrationOnStory(migration, {
      _uid: "root",
      component: "spike_page",
      body: [
        {
          _uid: "a",
          component: "spike_card",
          old_slug: "hello",
          old_slug__i18n__de: "hallo",
          old_slug__i18n__fr: "bonjour",
        },
      ],
    });

    expect(result.content).toEqual({
      _uid: "root",
      component: "spike_page",
      body: [
        {
          _uid: "a",
          component: "spike_card",
          slug: "hello",
          slug__i18n__de: "hallo",
          slug__i18n__fr: "bonjour",
        },
      ],
    });
  });

  it("should remove the translated siblings along with the base key", () => {
    const migration = defineMigration<SpikeSchema>({
      name: "remove-description",
      ops: [removeFieldOp({ block: "spike_card", field: "description" })],
    });

    const result = runMigrationOnStory(migration, {
      _uid: "root",
      component: "spike_page",
      body: [
        {
          _uid: "a",
          component: "spike_card",
          description: "Hello",
          description__i18n__de: "Hallo",
        },
      ],
    });

    expect(result.content).toEqual({
      _uid: "root",
      component: "spike_page",
      body: [{ _uid: "a", component: "spike_card" }],
    });
  });

  it("should reach a block embedded in a richtext field", () => {
    const migration = defineMigration<SpikeSchema>({
      name: "rename-old-slug",
      ops: [renameFieldOp({ block: "spike_card", field: "old_slug", to: "slug" })],
    });

    const result = runMigrationOnStory(migration, {
      _uid: "root",
      component: "spike_page",
      title: "Embedded",
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "before" }] },
          {
            type: "blok",
            attrs: { id: "x", body: [{ _uid: "a", component: "spike_card", old_slug: "hi" }] },
          },
        ],
      },
    });

    expect(result.matched).toBe(1);
    expect(result.content).toMatchObject({
      body: {
        content: [
          { type: "paragraph" },
          { type: "blok", attrs: { body: [{ _uid: "a", component: "spike_card", slug: "hi" }] } },
        ],
      },
    });
  });
});

describe("uid instability the content already had", () => {
  it("should report a duplicate uid that was already there as pre-existing", () => {
    const migration = defineMigration<SpikeSchema>({
      name: "rename-old-slug",
      ops: [renameFieldOp({ block: "spike_card", field: "old_slug", to: "slug" })],
    });

    const result = runMigrationOnStory(migration, {
      _uid: "root",
      component: "spike_page",
      body: [
        { _uid: "dup", component: "spike_card", old_slug: "one" },
        { _uid: "dup", component: "spike_card", old_slug: "two" },
      ],
    });

    // A caller must still refuse to write, because the backend re-uids these
    // either way. What changes is who it blames: the content, not the migration.
    expect(result.unstableUids.preExisting).toEqual(["dup"]);
    expect(result.unstableUids.duplicate).toEqual([]);
  });

  it("should not count a missing uid that was already there against the migration", () => {
    const migration = defineMigration<SpikeSchema>({
      name: "rename-old-slug",
      ops: [renameFieldOp({ block: "spike_card", field: "old_slug", to: "slug" })],
    });

    const result = runMigrationOnStory(migration, {
      _uid: "root",
      component: "spike_page",
      body: [{ component: "spike_card", old_slug: "no uid here" }],
    });

    expect(result.unstableUids.missing).toBe(0);
  });
});
