/**
 * Behaviour of the patch layer every other module rests on: which keys a field
 * occupies, whether a block can still be addressed by `_uid`, what a diff of one
 * block against itself records, and what replaying that record does to content
 * an editor has touched since.
 */
import { describe, expect, it } from "vitest";
import {
  type AnyBlock,
  applyPatches,
  baseFieldOf,
  type BlockPatch,
  diffBlock,
  findUnstableUids,
  indexBlocks,
  languageOfKey,
  translationKeysFor,
} from "./patch";

function card(overrides: Record<string, unknown> = {}): AnyBlock {
  return { _uid: "card-1", component: "spike_card", title: "Hello", ...overrides };
}

describe("translationKeysFor", () => {
  it("should find every language a field is translated into", () => {
    const block = card({ title__i18n__de: "Hallo", title__i18n__fr: "Bonjour" });
    expect(translationKeysFor(block, "title").sort()).toEqual([
      "title__i18n__de",
      "title__i18n__fr",
    ]);
  });

  it("should return nothing for a field with no translations", () => {
    expect(translationKeysFor(card(), "title")).toEqual([]);
  });

  it("should not claim the translations of a differently named field", () => {
    const block = card({ subtitle__i18n__de: "Untertitel" });
    expect(translationKeysFor(block, "title")).toEqual([]);
  });

  it("should not mistake a field whose name merely starts the same", () => {
    // `title_suffix__i18n__de` belongs to `title_suffix`, not to `title`.
    const block = card({ title_suffix__i18n__de: "Zusatz" });
    expect(translationKeysFor(block, "title")).toEqual([]);
  });
});

describe("languageOfKey", () => {
  it("should report no language for a base key", () => {
    expect(languageOfKey("title")).toBeUndefined();
  });

  it("should read the language a translated key carries", () => {
    expect(languageOfKey("title__i18n__de")).toBe("de");
  });

  it("should restore the hyphen a regional code is stored without", () => {
    // The stored form writes `-` as `_`, so `en-US` is kept as `en_US`.
    expect(languageOfKey("title__i18n__en_US")).toBe("en-US");
  });
});

describe("baseFieldOf", () => {
  it("should return the field a translated key belongs to", () => {
    expect(baseFieldOf("title__i18n__de")).toBe("title");
  });

  it("should return an untranslated key unchanged", () => {
    expect(baseFieldOf("title")).toBe("title");
  });
});

describe("findUnstableUids", () => {
  it("should report nothing for content whose every block has a unique uid", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [card({ _uid: "a" }), card({ _uid: "b" })],
    };
    expect(findUnstableUids(content)).toEqual({ duplicate: [], missing: 0 });
  });

  it("should name a uid two blocks share", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [card({ _uid: "dup" }), card({ _uid: "dup" })],
    };
    expect(findUnstableUids(content)).toEqual({ duplicate: ["dup"], missing: 0 });
  });

  it("should name a shared uid once however many blocks share it", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [card({ _uid: "dup" }), card({ _uid: "dup" }), card({ _uid: "dup" })],
    };
    expect(findUnstableUids(content).duplicate).toEqual(["dup"]);
  });

  it("should count a block with no uid at all", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [{ component: "spike_card", title: "no uid" }],
    };
    expect(findUnstableUids(content).missing).toBe(1);
  });

  it("should count a block whose uid is an empty string", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [{ _uid: "", component: "spike_card" }],
    };
    expect(findUnstableUids(content).missing).toBe(1);
  });

  it("should reach a block nested below an array in a plain object", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: { type: "doc", content: [{ type: "blok", attrs: { body: [card({ _uid: "root" })] } }] },
    };
    expect(findUnstableUids(content).duplicate).toEqual(["root"]);
  });
});

describe("indexBlocks", () => {
  it("should find blocks at any depth, through arrays and plain objects alike", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: {
        type: "doc",
        content: [{ type: "blok", attrs: { body: [card({ _uid: "embedded" })] } }],
      },
    };
    expect([...indexBlocks(content).keys()].sort()).toEqual(["embedded", "root"]);
  });

  it("should not treat an object without both envelope keys as a block", () => {
    const content = { _uid: "root", component: "spike_page", meta: { component: "no_uid" } };
    expect([...indexBlocks(content).keys()]).toEqual(["root"]);
  });
});

describe("diffBlock", () => {
  it("should record nothing when the block did not change", () => {
    expect(diffBlock(card(), card())).toBeNull();
  });

  it("should ignore the transport keys no migration owns", () => {
    // `_editable` is injected for the Visual Editor and never stored, so a block
    // that only gained one has not changed.
    expect(diffBlock(card(), card({ _editable: "<!--#storyblok-->" }))).toBeNull();
  });

  it("should record a rename as an unset of the old key and a set of the new one", () => {
    const renamed: AnyBlock = { _uid: "card-1", component: "spike_card", headline: "Hello" };
    const patch = diffBlock(card(), renamed);

    expect(patch?.ops).toContainEqual({ kind: "unset", key: "title", expect: "Hello" });
    expect(patch?.ops).toContainEqual({
      kind: "set",
      key: "headline",
      value: "Hello",
      expect: undefined,
    });
  });

  it("should carry the value it replaced, so a replay can tell it was not edited since", () => {
    const patch = diffBlock(card(), card({ title: "Goodbye" }));
    expect(patch?.ops).toEqual([{ kind: "set", key: "title", value: "Goodbye", expect: "Hello" }]);
  });

  it("should invert exactly by swapping its arguments", () => {
    const before = card();
    const after = card({ title: "Goodbye" });
    const forward = diffBlock(before, after);
    const backward = diffBlock(after, before);

    const replayed = structuredClone(after);
    applyPatches(replayed, backward === null ? [] : [backward]);
    expect(replayed).toEqual(before);
    expect(forward).not.toEqual(backward);
  });

  it("should record a reordered child list by uid rather than by replacing the array", () => {
    const one = { _uid: "one", component: "spike_meta", author: "Ada" };
    const two = { _uid: "two", component: "spike_meta", author: "Grace" };
    const patch = diffBlock(card({ meta: [one, two] }), card({ meta: [two, one] }));

    // Uids only: replaying it cannot clobber an edit made to a child's own
    // fields, which a whole-array `set` would.
    expect(patch?.ops).toEqual([
      { kind: "listOrder", key: "meta", uids: ["two", "one"], expect: ["one", "two"] },
    ]);
  });

  it("should record an added and a removed child separately from the order", () => {
    const one = { _uid: "one", component: "spike_meta" };
    const two = { _uid: "two", component: "spike_meta" };
    const patch = diffBlock(card({ meta: [one] }), card({ meta: [two] }));

    expect(patch?.ops).toContainEqual({
      kind: "listInsert",
      key: "meta",
      uid: "two",
      index: 0,
      block: two,
    });
    expect(patch?.ops).toContainEqual({ kind: "listRemove", key: "meta", uid: "one" });
  });

  it("should not fold a child block's own edits into its parent's patch", () => {
    const before = card({ meta: [{ _uid: "one", component: "spike_meta", author: "Ada" }] });
    const after = card({ meta: [{ _uid: "one", component: "spike_meta", author: "Grace" }] });
    expect(diffBlock(before, after)).toBeNull();
  });
});

describe("applyPatches", () => {
  function page(): Record<string, unknown> {
    return { _uid: "root", component: "spike_page", body: [card()] };
  }

  const renameToHeadline: BlockPatch = {
    uid: "card-1",
    component: "spike_card",
    ops: [
      { kind: "unset", key: "title", expect: "Hello" },
      { kind: "set", key: "headline", value: "Hello", expect: undefined },
    ],
  };

  it("should apply a patch whose block is untouched since the migration ran", () => {
    const content = page();
    const result = applyPatches(content, [renameToHeadline]);

    expect(result.conflicts).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(indexBlocks(content).get("card-1")).toEqual({
      _uid: "card-1",
      component: "spike_card",
      headline: "Hello",
    });
  });

  it("should report a block that is no longer in the content instead of throwing", () => {
    const result = applyPatches(page(), [{ ...renameToHeadline, uid: "deleted-since" }]);
    expect(result.missing).toEqual(["deleted-since"]);
    expect(result.applied).toBe(0);
  });

  it("should refuse a block an editor changed since, and say which key disagrees", () => {
    const content = { _uid: "root", component: "spike_page", body: [card({ title: "Edited" })] };
    const result = applyPatches(content, [renameToHeadline]);

    expect(result.conflicts).toEqual([
      {
        uid: "card-1",
        key: "title",
        reason: "live value differs from the value the migration wrote",
      },
    ]);
    expect(result.applied).toBe(0);
  });

  it("should skip a conflicting block whole rather than applying half a rename", () => {
    const content = { _uid: "root", component: "spike_page", body: [card({ title: "Edited" })] };
    applyPatches(content, [renameToHeadline]);

    // Half a rename would leave the block holding both names at once, which no
    // schema describes and no editor could have produced.
    const live = indexBlocks(content).get("card-1");
    expect(live).toEqual({ _uid: "card-1", component: "spike_card", title: "Edited" });
  });

  it("should still apply the patches for blocks that did not conflict", () => {
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [card({ title: "Edited" }), card({ _uid: "card-2" })],
    };
    const result = applyPatches(content, [
      renameToHeadline,
      { ...renameToHeadline, uid: "card-2" },
    ]);

    expect(result.conflicts).toHaveLength(1);
    expect(indexBlocks(content).get("card-2")).toHaveProperty("headline", "Hello");
  });

  it("should apply a conflicting patch anyway when the caller forces it", () => {
    const content = { _uid: "root", component: "spike_page", body: [card({ title: "Edited" })] };
    const result = applyPatches(content, [renameToHeadline], { force: true });

    expect(result.conflicts).toEqual([]);
    expect(indexBlocks(content).get("card-1")).toHaveProperty("headline", "Hello");
  });

  it("should refuse a reorder whose known children no longer sit in the recorded order", () => {
    const one = { _uid: "one", component: "spike_meta" };
    const two = { _uid: "two", component: "spike_meta" };
    const content = { _uid: "root", component: "spike_page", body: [card({ meta: [two, one] })] };

    const result = applyPatches(content, [
      {
        uid: "card-1",
        component: "spike_card",
        ops: [{ kind: "listOrder", key: "meta", uids: ["one", "two"], expect: ["one", "two"] }],
      },
    ]);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].key).toBe("meta");
  });

  it("should leave a child the patch never knew about in the slot it occupies", () => {
    const one = { _uid: "one", component: "spike_meta" };
    const two = { _uid: "two", component: "spike_meta" };
    const added = { _uid: "added-since", component: "spike_meta" };
    const content = {
      _uid: "root",
      component: "spike_page",
      body: [card({ meta: [one, added, two] })],
    };

    applyPatches(content, [
      {
        uid: "card-1",
        component: "spike_card",
        ops: [{ kind: "listOrder", key: "meta", uids: ["two", "one"], expect: ["one", "two"] }],
      },
    ]);

    const live = indexBlocks(content).get("card-1");
    expect(live?.meta).toEqual([two, added, one]);
  });

  it("should not insert a child that is already there, so a replay is safe to repeat", () => {
    const one = { _uid: "one", component: "spike_meta" };
    const content = { _uid: "root", component: "spike_page", body: [card({ meta: [one] })] };
    const insert: BlockPatch = {
      uid: "card-1",
      component: "spike_card",
      ops: [{ kind: "listInsert", key: "meta", uid: "one", index: 0, block: one }],
    };

    applyPatches(content, [insert]);
    applyPatches(content, [insert]);

    expect(indexBlocks(content).get("card-1")?.meta).toEqual([one]);
  });
});
