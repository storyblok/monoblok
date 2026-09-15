import { describe, expectTypeOf, it } from "vitest";
import { FIELD_TYPES } from "./field-types";
import type { FieldType } from "./generated/types/field";

describe("FIELD_TYPES", () => {
  // Equality in both directions: a new member of the generated union that is
  // missing from the list fails here, and so does an entry that is not a real
  // field type. Without this the runtime list would silently fall behind the
  // regenerated types.
  it("lists exactly the members of the generated FieldType union", () => {
    expectTypeOf<(typeof FIELD_TYPES)[number]>().toEqualTypeOf<FieldType>();
  });
});
