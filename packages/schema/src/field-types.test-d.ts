import { describe, expectTypeOf, it } from "vitest";
import { FIELD_TYPES } from "./field-types";
import type { FieldType } from "./generated/types/field";

describe("FIELD_TYPES", () => {
  // A new member of the generated union that the list is missing fails here,
  // naming the member itself: `toEqualTypeOf` reports the same drift as two
  // truncated unions the reader has to diff by hand. The other direction —
  // an entry that is not a real field type — fails at the `satisfies` clause
  // in `field-types.ts`, which already points at the offending line.
  it("lists every member of the generated FieldType union", () => {
    expectTypeOf<Exclude<FieldType, (typeof FIELD_TYPES)[number]>>().toBeNever();
  });
});
