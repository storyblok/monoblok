import { describe, expect, it } from "vitest";
import { hasRequiredFields, toRequestBody } from "./request";
import type { ResourceFields } from "./fields";

const noun = { singular: "thing", plural: "things" };

const fields = {
  writable: {
    name: { type: "string", required: true, nullable: false },
    note: { type: "string", required: false, nullable: true },
  },
  readOnly: [],
} as const satisfies ResourceFields;

describe("toRequestBody", () => {
  it("should copy only the fields the payload holds", () => {
    expect(toRequestBody(fields, { note: null }, noun)).toEqual({ note: null });
  });

  it("should fail on a field the request cannot take, naming it", () => {
    expect(() => toRequestBody(fields, { name: 1, note: "a", extra: "x" }, noun)).toThrow(
      "The CLI cannot write these thing fields: name, extra.",
    );
  });
});

describe("hasRequiredFields", () => {
  it("should tell whether the body holds every field the descriptor requires", () => {
    expect(hasRequiredFields(fields, { name: "a" })).toBe(true);
    expect(hasRequiredFields(fields, { note: "a" })).toBe(false);
  });
});
