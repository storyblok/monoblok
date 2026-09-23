/**
 * Behaviour of `deriveInverse`: which ops invert, what their mirror op looks
 * like, and that the derived list replays in reverse order.
 */
import { describe, expect, it } from "vitest";
import { deriveInverse } from "./derive-inverse";
import { addField, removeField, renameField } from "./ops";
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
});
