import { describe, expect, it } from "vitest";
import { buildResourceFields, renderResourceFields } from "./resource-fields.ts";

const thing = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    note: { type: ["string", "null"] },
    tags: { type: "array", items: { type: "string" } },
    enabled: { type: "boolean" },
    weight: { type: "number" },
    config: { type: "object" },
    created_at: { type: "string", format: "date-time" },
  },
};

const thingRequest = (required?: string[]) => ({
  type: "object",
  properties: {
    thing: {
      type: "object",
      ...(required ? { required } : {}),
      properties: {
        name: { type: "string" },
        note: { type: ["string", "null"] },
        tags: { type: "array", items: { type: "string" } },
        enabled: { type: "boolean" },
        weight: { type: "number" },
        config: { type: "object" },
      },
    },
  },
  required: ["thing"],
});

const jsonBody = (ref: string) => ({
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});
const envelopedResponse = (key: string, ref: string) => ({
  "200": {
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: { [key]: { $ref: `#/components/schemas/${ref}` } },
        },
      },
    },
  },
});

const spec = {
  paths: {
    "/things": {
      post: {
        operationId: "createThing",
        requestBody: jsonBody("CreateThingRequest"),
        responses: envelopedResponse("thing", "Thing"),
      },
    },
    "/things/{id}": {
      get: { operationId: "getThing", responses: envelopedResponse("thing", "Thing") },
      patch: { operationId: "updateThing", requestBody: jsonBody("ThingRequest") },
    },
  },
  components: {
    schemas: {
      Thing: thing,
      ThingRequest: thingRequest(),
      CreateThingRequest: thingRequest(["name", "tags"]),
    },
  },
};

const source = {
  name: "thing",
  envelope: "thing",
  create: "createThing",
  update: "updateThing",
  read: "getThing",
};

describe("buildResourceFields", () => {
  it("should describe the writable fields of the request envelope with their types", () => {
    const fields = buildResourceFields(spec, source);

    expect(fields.writable).toEqual({
      name: { type: "string", required: true, nullable: false },
      note: { type: "string", required: false, nullable: true },
      tags: { type: "string[]", required: true, nullable: false },
      enabled: { type: "boolean", required: false, nullable: false },
      weight: { type: "number", required: false, nullable: false },
      config: { type: "json", required: false, nullable: false },
    });
  });

  it("should list the response fields no request accepts as read-only", () => {
    const fields = buildResourceFields(spec, source);

    expect(fields.readOnly).toEqual(["created_at", "id"]);
  });

  it("should fail on a schema composition it cannot read", () => {
    const composed = JSON.parse(JSON.stringify(spec));
    composed.components.schemas.ThingRequest = {
      type: "object",
      properties: { thing: { allOf: [{ $ref: "#/components/schemas/Thing" }] } },
      required: ["thing"],
    };

    expect(() => buildResourceFields(composed, source)).toThrow(/allOf/);

    const union = JSON.parse(JSON.stringify(spec));
    union.components.schemas.Thing.properties.note = {
      anyOf: [{ type: "string" }, { type: "null" }],
    };
    union.components.schemas.ThingRequest.properties.thing.properties.note = {
      anyOf: [{ type: "string" }, { type: "null" }],
    };

    expect(() => buildResourceFields(union, source)).toThrow(/"note" uses `anyOf`/);
  });

  it("should read a body that holds more than the envelope", () => {
    const withOptions = JSON.parse(JSON.stringify(spec));
    withOptions.components.schemas.ThingRequest.properties.force_update = { type: "boolean" };

    expect(buildResourceFields(withOptions, source).writable).not.toHaveProperty("force_update");
  });

  it("should fail on a body without the envelope key", () => {
    expect(() => buildResourceFields(spec, { ...source, envelope: "other" })).toThrow(/"other"/);
  });

  it("should fail on an operation the spec does not declare", () => {
    expect(() => buildResourceFields(spec, { ...source, update: "patchThing" })).toThrow(
      /patchThing/,
    );
  });
});

describe("renderResourceFields", () => {
  it("should emit each resource as an importable constant", async () => {
    const output = renderResourceFields([{ name: "thing", ...buildResourceFields(spec, source) }]);
    const module = await import(`data:text/javascript,${encodeURIComponent(stripTypes(output))}`);

    expect(module.thingFields.writable.tags.type).toBe("string[]");
  });
});

/** The rendered module is TypeScript only for its `as const`; drop it to load it as JavaScript. */
function stripTypes(source: string): string {
  return source.replace(/ as const/g, "");
}
