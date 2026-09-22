/**
 * SPIKE — field-level translation.
 *
 * Both fixtures are Management API read-backs of the same story, taken either
 * side of a save made in the real Visual Editor with the language switched to
 * German and the per-field translate toggle turned on for three fields. They
 * are the only evidence of the wire format that we did not author ourselves.
 */
import { describe, expect, it } from "vitest";

import { applyPatches, diffBlock, indexBlocks, translationKeysFor } from "../src/patch";
import { runMigrationOnStory } from "../src/runner";
import { defineMigration } from "../src/define-migration";
import { alterField } from "../src/ops";
import { renameField } from "../migrations";
import type { SpikeSchema } from "../fixtures/schema";
import editorI18nAfter from "../fixtures/editor-i18n-after.json" with { type: "json" };
import editorI18nBefore from "../fixtures/editor-i18n-before.json" with { type: "json" };

type Block = Record<string, unknown> & { _uid: string; component: string };

function block(content: unknown, uid: string): Record<string, unknown> {
  const found = indexBlocks(content).get(uid);
  if (!found) throw new Error(`no block ${uid}`);
  return found;
}

describe("wire format of a field-level translation", () => {
  const before = editorI18nBefore as Record<string, unknown>;
  const after = editorI18nAfter as Record<string, unknown>;

  it("stores the translation as a sibling key inside the same block", () => {
    expect(after.author).toBe("Ada Lovelace");
    expect(after.author__i18n__de).toBe("Ada auf Deutsch");
  });

  it("leaves the default language on the bare key", () => {
    expect(after.author).toBe(before.author);
  });

  it("writes the field type's empty value for a translation toggled on but not filled", () => {
    expect(after.subtitle__i18n__de).toBe("");
    expect(after.promoted__i18n__de).toBe(false);
  });

  it("backfills schema defaults onto the bare key even while editing in German", () => {
    // The backfill is language-unaware, so it never produces an `__i18n__` key.
    expect(before.price).toBeUndefined();
    expect(after.price).toBe("");
    expect(Object.keys(after).filter((key) => key.startsWith("price__i18n__"))).toEqual([]);
  });
});

describe("differ over a translated block", () => {
  it("treats a translation as an ordinary content key", () => {
    const patch = diffBlock(editorI18nBefore as Block, editorI18nAfter as Block);

    expect(patch?.ops.map((op) => op.key).sort()).toEqual([
      "author__i18n__de",
      "price",
      "promoted__i18n__de",
      "subtitle__i18n__de",
    ]);
  });
});

/**
 * The failure this guards against: a rename that moves only the base key leaves
 * the translation under a field name the schema no longer declares. The
 * delivery API drops such a key, so the translated site silently falls back to
 * the default-language value and the translation is gone from content.
 */
describe("renameTo carries the whole field family", () => {
  const storyContent = (): unknown => structuredClone(editorI18nAfter);

  it("moves every `<field>__i18n__<lang>` sibling with the base key", () => {
    const run = runMigrationOnStory(renameField, storyContent());
    const root = block(run.content, "article-root") as Block;

    expect(root.byline).toBe("Ada Lovelace");
    expect(root.byline__i18n__de).toBe("Ada auf Deutsch");
    expect(translationKeysFor(root, "author")).toEqual([]);
    expect("author" in root).toBe(false);
  });

  it("records the translation in the patch, so the inverse restores it", () => {
    const original = storyContent();
    const run = runMigrationOnStory(renameField, structuredClone(original));
    const keys = run.patches.flatMap((patch) => patch.ops.map((op) => op.key));

    expect(keys).toContain("author__i18n__de");
    expect(keys).toContain("byline__i18n__de");

    const rolledBack = structuredClone(run.content);
    const result = applyPatches(rolledBack, run.inverse);

    expect(result.conflicts).toEqual([]);
    expect(rolledBack).toEqual(original);
  });
});

describe("alterField over a translation family", () => {
  it("should run the callback once per language, base key included", () => {
    const seen: (string | undefined)[] = [];
    const migration = defineMigration<SpikeSchema>([
      alterField({ block: "spike_article", field: "author" }, (value, context) => {
        seen.push(context.language);
        return value;
      }),
    ]);

    runMigrationOnStory(migration, structuredClone(editorI18nAfter) as Record<string, unknown>);

    // `undefined` is the base key holding the default language. The list comes
    // from the block's own keys, never from the schema: the language set is
    // space state and differs between the spaces one migration runs against.
    //
    // Twice over, because the idempotency check replays every `alter` on a copy
    // of the block and compares. That is the design working, but it means an
    // author's callback is invoked twice per block and must not have side
    // effects — the docs have to say so.
    expect(seen).toEqual([undefined, "de", undefined, "de"]);
  });

  it("should let a callback treat one language differently", () => {
    const migration = defineMigration<SpikeSchema>([
      alterField({ block: "spike_article", field: "author" }, (value, { language }) =>
        language === "de" ? `${value} (DE)` : value,
      ),
    ]);

    const run = runMigrationOnStory(
      migration,
      structuredClone(editorI18nAfter) as Record<string, unknown>,
    );

    expect(block(run.content, "article-root").author).toBe("Ada Lovelace");
    expect(block(run.content, "article-root").author__i18n__de).toBe("Ada auf Deutsch (DE)");
  });
});
