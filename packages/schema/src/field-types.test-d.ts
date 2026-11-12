import { describe, expectTypeOf, it } from "vitest";
import { FIELD_TYPES, LAYOUT_FIELD_TYPES } from "./field-types";
import type { FieldType, LayoutFieldType } from "./generated/types/field";

describe("FIELD_TYPES", () => {
  // `Exclude` names the missing member; `toEqualTypeOf` would only print two
  // truncated unions. The reverse direction is covered by `satisfies` in
  // `field-types.ts`.
  it("lists every member of the generated FieldType union", () => {
    expectTypeOf<Exclude<FieldType, (typeof FIELD_TYPES)[number]>>().toBeNever();
  });
});

describe("LAYOUT_FIELD_TYPES", () => {
  // The reverse direction is covered by `satisfies` in `field-types.ts`.
  it("lists every layout field type the content types leave out", () => {
    expectTypeOf<Exclude<LayoutFieldType, (typeof LAYOUT_FIELD_TYPES)[number]>>().toBeNever();
  });
});
