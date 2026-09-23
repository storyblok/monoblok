/**
 * Behaviour of `deriveInverse`: which ops invert, what their mirror op looks
 * like, and that the derived list replays in reverse order.
 */
import { describe, expect, it } from "vitest";
import { defineMigration } from "./define-migration";
import { deriveInverse } from "./derive-inverse";
import { addField, mergeFields, removeField, renameBlock, renameField, splitField } from "./ops";
import { runMigrationOnStory } from "./runner";
import type { SchemaShape } from "./types";

type AnySchema = SchemaShape;

/** First word / rest, split at the first space — the fixture used throughout. */
function splitOnFirstSpace(name: unknown): readonly [string, string] {
  const value = String(name);
  const at = value.indexOf(" ");
  return at === -1 ? [value, ""] : [value.slice(0, at), value.slice(at + 1)];
}

function joinNonEmpty(values: readonly unknown[]): unknown {
  return values.filter(Boolean).join(" ");
}

describe("deriveInverse", () => {
  it("inverts addField to removeField", () => {
    const derived = deriveInverse([
      addField<AnySchema, AnySchema, "card">({ block: "card", field: "slug" }, () => "x"),
    ]);

    expect(derived.derivable).toBe(true);
    expect(derived.ops).toEqual([{ kind: "removeField", block: "card", field: "slug" }]);
    expect(derived.lossy).toEqual([]);
  });

  it("refuses to invert removeField", () => {
    const derived = deriveInverse([
      removeField<AnySchema, AnySchema, "card">({ block: "card", field: "slug" }),
    ]);

    expect(derived.derivable).toBe(false);
    expect(derived.blocked).toEqual([
      { index: 0, kind: "removeField", reason: "the values are gone" },
    ]);
  });

  it("reverses the order of the derived ops", () => {
    const derived = deriveInverse([
      renameField<AnySchema, AnySchema, "card">({ block: "card", field: "a", to: "b" }),
      renameField<AnySchema, AnySchema, "card">({ block: "card", field: "c", to: "d" }),
    ]);

    expect(derived.ops).toEqual([
      { kind: "renameField", block: "card", field: "d", to: "c" },
      { kind: "renameField", block: "card", field: "b", to: "a" },
    ]);
  });

  it("inverts splitField to mergeFields when the counterpart is given", () => {
    const derived = deriveInverse([
      splitField<AnySchema, AnySchema, "author">(
        {
          block: "author",
          field: "name",
          into: ["first_name", "last_name"],
          merge: (values) => values.filter(Boolean).join(" "),
        },
        (name) => String(name).split(" ", 2),
      ),
    ]);

    expect(derived.derivable).toBe(true);
    expect(derived.ops[0]).toMatchObject({
      kind: "mergeFields",
      block: "author",
      fields: ["first_name", "last_name"],
      into: "name",
    });
  });

  it("refuses to invert splitField without a counterpart", () => {
    const derived = deriveInverse([
      splitField<AnySchema, AnySchema, "author">(
        { block: "author", field: "name", into: ["first_name", "last_name"] },
        (name) => String(name).split(" ", 2),
      ),
    ]);

    expect(derived.derivable).toBe(false);
    expect(derived.blocked[0].reason).toContain("no `merge`");
  });

  it("marks a derivable splitField inverse as lossy", () => {
    const derived = deriveInverse([
      splitField<AnySchema, AnySchema, "author">(
        {
          block: "author",
          field: "name",
          into: ["first_name", "last_name"],
          merge: (values) => values.filter(Boolean).join(" "),
        },
        (name) => String(name).split(" ", 2),
      ),
    ]);

    expect(derived.lossy).toEqual([0]);
  });

  it("inverts mergeFields to splitField when the counterpart is given", () => {
    const derived = deriveInverse([
      mergeFields<AnySchema, AnySchema, "author">(
        {
          block: "author",
          fields: ["first_name", "last_name"],
          into: "name",
          split: (name) => String(name).split(" ", 2),
        },
        (values) => values.filter(Boolean).join(" "),
      ),
    ]);

    expect(derived.derivable).toBe(true);
    expect(derived.ops[0]).toMatchObject({
      kind: "splitField",
      block: "author",
      field: "name",
      into: ["first_name", "last_name"],
    });
  });

  it("refuses to invert mergeFields without a counterpart", () => {
    const derived = deriveInverse([
      mergeFields<AnySchema, AnySchema, "author">(
        { block: "author", fields: ["first_name", "last_name"], into: "name" },
        (values) => values.filter(Boolean).join(" "),
      ),
    ]);

    expect(derived.derivable).toBe(false);
    expect(derived.blocked[0].reason).toContain("no `split`");
  });

  it("marks a derivable mergeFields inverse as lossy", () => {
    const derived = deriveInverse([
      mergeFields<AnySchema, AnySchema, "author">(
        {
          block: "author",
          fields: ["first_name", "last_name"],
          into: "name",
          split: (name) => String(name).split(" ", 2),
        },
        (values) => values.filter(Boolean).join(" "),
      ),
    ]);

    expect(derived.lossy).toEqual([0]);
  });

  it("replays a derived mergeFields inverse after splitField, and shows where the round trip loses data", () => {
    const forward = defineMigration<AnySchema>({
      ops: [
        splitField<AnySchema, AnySchema, "author">(
          {
            block: "author",
            field: "name",
            into: ["first_name", "last_name"],
            merge: joinNonEmpty,
          },
          splitOnFirstSpace,
        ),
      ],
    });

    // A leading space: splitOnFirstSpace hands it to `first_name` as "", and
    // `joinNonEmpty`'s `filter(Boolean)` drops that empty part on the way
    // back — the separator it stood for is gone with it. This is not a
    // contrived edge case: an editor pasting a name with a stray leading
    // space is ordinary content, and the round trip does not restore it.
    const original = {
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "author", name: " Ada Lovelace" }],
    };

    const migrated = runMigrationOnStory(forward, original);
    expect(migrated.content).toEqual({
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "author", first_name: "", last_name: "Ada Lovelace" }],
    });

    const derived = deriveInverse(forward.ops);
    expect(derived.derivable).toBe(true);
    expect(derived.lossy).toEqual([0]);

    const rolledBack = runMigrationOnStory(
      { ...forward, ops: derived.ops, targets: ["author"] },
      migrated.content,
    );

    // Restored, but not to the original: the leading space is gone.
    expect(rolledBack.content).toEqual({
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "author", name: "Ada Lovelace" }],
    });
  });

  it("replays a derived splitField inverse after mergeFields, and shows where the round trip loses data", () => {
    const forward = defineMigration<AnySchema>({
      ops: [
        mergeFields<AnySchema, AnySchema, "author">(
          {
            block: "author",
            fields: ["first_name", "last_name"],
            into: "name",
            split: splitOnFirstSpace,
          },
          joinNonEmpty,
        ),
      ],
    });

    // Only the last name was ever filled in. `joinNonEmpty` drops the empty
    // `first_name` and produces a single-word value, so the derived split
    // — which puts a whole single-word value into `first_name` and leaves
    // `last_name` empty — cannot tell that word was a last name, not a
    // first one. This is the ordinary "editor left a field blank" case, not
    // a contrived one.
    const original = {
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "author", first_name: "", last_name: "Lovelace" }],
    };

    const migrated = runMigrationOnStory(forward, original);
    expect(migrated.content).toEqual({
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "author", name: "Lovelace" }],
    });

    const derived = deriveInverse(forward.ops);
    expect(derived.derivable).toBe(true);
    expect(derived.lossy).toEqual([0]);

    const rolledBack = runMigrationOnStory(
      { ...forward, ops: derived.ops, targets: ["author"] },
      migrated.content,
    );

    // Restored, but not to the original: the value that was `last_name`
    // landed on `first_name` instead.
    expect(rolledBack.content).toEqual({
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "author", first_name: "Lovelace", last_name: "" }],
    });
  });

  it("inverts renameBlock", () => {
    const derived = deriveInverse([
      renameBlock<AnySchema, AnySchema, "card">({ block: "card", to: "teaser" }),
    ]);

    expect(derived.derivable).toBe(true);
    expect(derived.ops).toEqual([{ kind: "renameBlock", block: "teaser", to: "card" }]);
    expect(derived.lossy).toEqual([]);
  });

  it("replays a derived renameBlock inverse and restores the original component name", () => {
    const forward = defineMigration<AnySchema>({
      ops: [renameBlock<AnySchema, AnySchema, "card">({ block: "card", to: "teaser" })],
    });

    const original = {
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "card", title: "one" }],
    };

    const migrated = runMigrationOnStory(forward, original);
    expect(migrated.content).toEqual({
      _uid: "root",
      component: "page",
      body: [{ _uid: "a", component: "teaser", title: "one" }],
    });

    const derived = deriveInverse(forward.ops);
    expect(derived.derivable).toBe(true);
    expect(derived.lossy).toEqual([]);

    const rolledBack = runMigrationOnStory(
      { ...forward, ops: derived.ops, targets: ["teaser"] },
      migrated.content,
    );

    expect(rolledBack.content).toEqual(original);
  });
});
