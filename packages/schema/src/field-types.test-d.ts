import { describe, expectTypeOf, it } from "vitest";
import { FIELD_TYPES } from "./field-types";
import type { FieldType } from "./generated/types/field";

describe("FIELD_TYPES", () => {
  // `Exclude` names the missing member; `toEqualTypeOf` would only print two
  // truncated unions. The reverse direction is covered by `satisfies` in
  // `field-types.ts`.
  it("lists every member of the generated FieldType union", () => {
    expectTypeOf<Exclude<FieldType, (typeof FIELD_TYPES)[number]>>().toBeNever();
  });
});
