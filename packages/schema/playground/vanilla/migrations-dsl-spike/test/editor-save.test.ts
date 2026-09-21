import { describe, expect, it } from "vitest";

import editorBackfillAfter from "../fixtures/editor-backfill-after.json" with { type: "json" };
import editorBackfillBefore from "../fixtures/editor-backfill-before.json" with { type: "json" };
import editorSaveAfter from "../fixtures/editor-save-after.json" with { type: "json" };
import editorSaveBefore from "../fixtures/editor-save-before.json" with { type: "json" };
import { type AnyBlock, diffBlock, indexBlocks } from "../src/patch";

/**
 * The `after` fixture is the story read back through the Management API after a
 * human-driven save in the Visual Editor that changed one `og_title` and
 * nothing else. It grounds the differ's transport-key ignore-list against what
 * the editor actually writes, which no round trip we author ourselves can.
 */
describe("differ over Visual-Editor-saved content", () => {
  const before = indexBlocks(editorSaveBefore);
  const after = indexBlocks(editorSaveAfter);

  it("sees the same blocks by uid before and after an editor save", () => {
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
  });

  it("emits only the op for the field the editor changed", () => {
    const patches = [...before].flatMap(([uid, block]) => {
      const patch = diffBlock(block, after.get(uid) as AnyBlock);
      return patch ? [patch] : [];
    });

    expect(patches).toEqual([
      {
        uid: "meta-top",
        component: "spike_meta",
        ops: [{ kind: "set", key: "og_title", value: "Top EDITED", expect: "Top" }],
      },
    ]);
  });
});

/**
 * The same story, opened in the Visual Editor and saved with no user change at
 * all, after a field was added to its root component's schema. The editor
 * backfills every schema key the block does not have with that field type's
 * empty value, so a plain save rewrites content the user never touched.
 */
describe("differ over a Visual-Editor save that backfilled schema defaults", () => {
  const before = indexBlocks(editorBackfillBefore);
  const after = indexBlocks(editorBackfillAfter);

  it("emits a phantom set for every schema key the editor backfilled", () => {
    const patches = [...before].flatMap(([uid, block]) => {
      const patch = diffBlock(block, after.get(uid) as AnyBlock);
      return patch ? [patch] : [];
    });

    expect(patches).toHaveLength(1);
    expect(patches[0]!.uid).toBe("page-root");
    expect(patches[0]!.ops.map((op) => [op.kind, op.key]).sort()).toEqual([
      ["set", "cover"],
      ["set", "hero_link"],
      ["set", "intro"],
      ["set", "promoted"],
      ["set", "subtitle"],
      ["set", "tags"],
    ]);
  });
});
