import { describe, expect, it } from "vitest";

import { applyMigration } from "./apply-migration";
import { defineMigration } from "./define-migration";
import { coerceField, coercionBetween } from "./ops";

function coerce(fromType: string, toType: string, value: unknown) {
  const coercion = coercionBetween(fromType, toType);
  if (!coercion) return undefined;
  const outcome = applyMigration({
    migration: defineMigration([coerceField({ block: "hero", field: "x", ...coercion })]),
    id: "0001",
    space: "1",
    stories: [{ id: 1, slug: "home", content: { _uid: "a", component: "hero", x: value } }],
  });
  return outcome.writes[0]?.content.x;
}

describe("coercionBetween", () => {
  it("should offer the conversions coerceField performs", () => {
    expect(coerce("text", "number", " 03 ")).toBe("3");
    expect(coerce("number", "markdown", 4)).toBe("4");
    expect(coerce("textarea", "boolean", "true")).toBe(true);
  });

  it("should treat the string field types as storing the same value", () => {
    expect(coercionBetween("text", "markdown")).toEqual({ from: "string", to: "string" });
  });

  it("should not offer conversions coerceField refuses or does not know", () => {
    expect(coercionBetween("boolean", "number")).toBeUndefined();
    expect(coercionBetween("number", "boolean")).toBeUndefined();
    expect(coercionBetween("text", "richtext")).toBeUndefined();
    expect(coercionBetween("constructor", "text")).toBeUndefined();
  });
});
