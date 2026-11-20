import { describe, expect, it } from "vitest";
import { requestBodies } from "./request";
import type { ResourceFields } from "./fields";

const noun = { singular: "thing", plural: "things" };

type Rule = { field: string; equals: string };
type ThingRequest = { name?: string; note?: string | null; rules?: Rule[] };

const fields = {
  writable: {
    name: { type: "string", required: true, nullable: false },
    note: { type: "string", required: false, nullable: true },
    rules: { type: "json", required: false, nullable: false },
  },
  readOnly: [],
} as const satisfies ResourceFields;

const isRule = (value: unknown): value is Rule =>
  typeof value === "object" &&
  value !== null &&
  "field" in value &&
  typeof value.field === "string" &&
  "equals" in value &&
  typeof value.equals === "string";

const isRules = (value: unknown): value is Rule[] => Array.isArray(value) && value.every(isRule);

const things = requestBodies<ThingRequest>()(fields, { rules: isRules }, noun);

describe("requestBodies", () => {
  it("should copy only the fields the payload holds", () => {
    const body: ThingRequest = things.update({ note: null });

    expect(body).toEqual({ note: null });
  });

  it("should check a json field with the resource's guard", () => {
    const rules = [{ field: "a", equals: "b" }];

    expect(things.update({ rules })).toEqual({ rules });
    expect(() => things.update({ rules: [{ field: 1 }] })).toThrow(/rules/);
  });

  it("should fail on a field the request cannot take, naming it", () => {
    expect(() => things.update({ name: 1, note: "a", extra: "x" })).toThrow(
      "The CLI cannot write these thing fields: name, extra.",
    );
  });

  it("should fail a create that lacks a required field", () => {
    expect(things.create({ name: "a" })).toEqual({ name: "a" });
    expect(() => things.create({ note: "a" })).toThrow(/required/);
  });

  it("should not compile when the descriptor lacks a field the request type has", () => {
    const partial = { writable: { name: fields.writable.name }, readOnly: [] } as const;

    // @ts-expect-error `note` and `rules` are missing from the descriptor.
    requestBodies<ThingRequest>()(partial, {}, noun);
  });

  it("should not compile without a guard for each json field", () => {
    // @ts-expect-error `rules` has no guard.
    requestBodies<ThingRequest>()(fields, {}, noun);
  });
});
