/**
 * Behaviour of `deriveInverse`: which ops invert, what their mirror op looks
 * like, and that the derived list replays in reverse order.
 */
import { describe, expect, it } from "vitest";
import { deriveInverse } from "./derive-inverse";
import { addField, mergeFields, removeField, renameField, splitField } from "./ops";
import type { SchemaShape } from "./types";

type AnySchema = SchemaShape;

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
});
