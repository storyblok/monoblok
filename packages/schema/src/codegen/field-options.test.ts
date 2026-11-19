import * as z from "zod";
import { describe, expect, it } from "vitest";

import { zComponentSchemaField } from "../generated/overlay/zod.gen";
import { getOptionSchemasByFieldType } from "./field-options";

/** Property names a JSON Schema declares, through `allOf`/`anyOf`/`oneOf`. */
function jsonSchemaKeys(schema: unknown): string[] {
  if (typeof schema !== "object" || schema === null) {
    return [];
  }
  const own =
    "properties" in schema && typeof schema.properties === "object" && schema.properties !== null
      ? Object.keys(schema.properties)
      : [];
  const nested = Object.entries(schema)
    .filter(([key, value]) => ["allOf", "anyOf", "oneOf"].includes(key) && Array.isArray(value))
    .flatMap(([, value]: [string, unknown[]]) => value.flatMap(jsonSchemaKeys));
  return [...own, ...nested];
}

describe("getOptionSchemasByFieldType", () => {
  it("should read every option each field type declares in the spec", () => {
    const derived = [...getOptionSchemasByFieldType().values()].map((options) =>
      [...options.keys()].sort(),
    );
    const declared = zComponentSchemaField.options.map((variant) =>
      [...new Set(jsonSchemaKeys(z.toJSONSchema(variant, { unrepresentable: "any" })))].sort(),
    );

    expect(derived).toEqual(declared);
  });
});
