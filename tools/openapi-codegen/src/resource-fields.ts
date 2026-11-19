/**
 * Field descriptors for resources a CLI command writes field by field
 * (`--set name=value`).
 *
 * The TypeScript types say what a request accepts at compile time, but a flag
 * value arrives as a string at run time: the command has to know which fields
 * exist, how to coerce a value for each, which ones are required on create,
 * which ones accept `null`, and which response fields it must never send back.
 * This reads exactly that from the request and response schemas of a
 * resource's operations.
 */

/** How a flag value is coerced for the field. `json` is any object or mixed value. */
export type ResourceFieldType = "string" | "boolean" | "number" | "string[]" | "json";

export interface ResourceField {
  type: ResourceFieldType;
  /** Required by the create operation. */
  required: boolean;
  /** Accepts `null`, which is how a field is cleared. */
  nullable: boolean;
}

export interface ResourceFields {
  /** The key the request and response bodies wrap the resource in. */
  envelope: string;
  writable: Record<string, ResourceField>;
  /** Response fields no request accepts, sorted. */
  readOnly: string[];
}

export interface ResourceFieldsSource {
  /** Prefix of the emitted constant: `webhook` → `webhookFields`. */
  name: string;
  /** Operation IDs. */
  create: string;
  update: string;
  read: string;
}

type SchemaObject = Record<string, unknown>;

const SCHEMA_REF_PREFIX = "#/components/schemas/";
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

function isRecord(value: unknown): value is SchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRef(spec: SchemaObject, schema: unknown): SchemaObject {
  if (!isRecord(schema)) {
    return {};
  }
  if (typeof schema.$ref === "string" && schema.$ref.startsWith(SCHEMA_REF_PREFIX)) {
    const name = schema.$ref.slice(SCHEMA_REF_PREFIX.length);
    const components = isRecord(spec.components) ? spec.components : {};
    const schemas = isRecord(components.schemas) ? components.schemas : {};
    return resolveRef(spec, schemas[name]);
  }
  return schema;
}

function findOperation(spec: SchemaObject, operationId: string): SchemaObject {
  const paths = isRecord(spec.paths) ? spec.paths : {};
  for (const pathItem of Object.values(paths)) {
    if (!isRecord(pathItem)) {
      continue;
    }
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (isRecord(operation) && operation.operationId === operationId) {
        return operation;
      }
    }
  }
  throw new Error(`Operation "${operationId}" not found in the spec.`);
}

function jsonSchemaOf(spec: SchemaObject, container: unknown): SchemaObject {
  const content = isRecord(container) && isRecord(container.content) ? container.content : {};
  const json = content["application/json"];
  return resolveRef(spec, isRecord(json) ? json.schema : undefined);
}

const COMPOSITIONS = ["allOf", "anyOf", "oneOf"] as const;

/**
 * Fails on a schema built by composition. Reading it as an empty object or an
 * untyped value would emit a descriptor that silently rejects valid fields.
 */
function assertPlain(schema: SchemaObject, where: string): SchemaObject {
  const composition = COMPOSITIONS.find((keyword) => keyword in schema);
  if (composition) {
    throw new Error(`${where} uses \`${composition}\`, which resource fields do not support.`);
  }
  return schema;
}

/** A body that wraps the resource in a single key, e.g. `{ webhook_endpoint: {…} }`. */
function unwrapEnvelope(
  spec: SchemaObject,
  body: SchemaObject,
  operationId: string,
): { envelope: string; schema: SchemaObject } {
  assertPlain(body, `The body of "${operationId}"`);
  const properties = isRecord(body.properties) ? body.properties : {};
  const keys = Object.keys(properties);
  if (keys.length !== 1) {
    throw new Error(`Operation "${operationId}" does not wrap its body in a single envelope key.`);
  }
  const schema = resolveRef(spec, properties[keys[0]]);
  return { envelope: keys[0], schema: assertPlain(schema, `"${keys[0]}" in "${operationId}"`) };
}

function requestBody(spec: SchemaObject, operationId: string) {
  const operation = findOperation(spec, operationId);
  return unwrapEnvelope(spec, jsonSchemaOf(spec, operation.requestBody), operationId);
}

function responseBody(spec: SchemaObject, operationId: string) {
  const operation = findOperation(spec, operationId);
  const responses = isRecord(operation.responses) ? operation.responses : {};
  const success = Object.keys(responses).find((status) => status.startsWith("2"));
  if (!success) {
    throw new Error(`Operation "${operationId}" declares no success response.`);
  }
  return unwrapEnvelope(spec, jsonSchemaOf(spec, responses[success]), operationId);
}

function propertiesOf(schema: SchemaObject): SchemaObject {
  return isRecord(schema.properties) ? schema.properties : {};
}

function typesOf(schema: SchemaObject): string[] {
  if (Array.isArray(schema.type)) {
    return schema.type.filter((type): type is string => typeof type === "string");
  }
  return typeof schema.type === "string" ? [schema.type] : [];
}

function isNullable(schema: SchemaObject): boolean {
  return schema.nullable === true || typesOf(schema).includes("null");
}

function fieldType(spec: SchemaObject, schema: SchemaObject): ResourceFieldType {
  const [type] = typesOf(schema).filter((candidate) => candidate !== "null");
  switch (type) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "integer":
    case "number":
      return "number";
    case "array": {
      const items = resolveRef(spec, schema.items);
      return typesOf(items).includes("string") ? "string[]" : "json";
    }
    default:
      return "json";
  }
}

/**
 * Reads a resource's field descriptor from a parsed OpenAPI document.
 *
 * Writable fields are the union of what create and update accept; `required`
 * comes from create, `nullable` from either. Read-only fields are what the read
 * operation returns beyond that.
 */
export function buildResourceFields(spec: unknown, source: ResourceFieldsSource): ResourceFields {
  if (!isRecord(spec)) {
    throw new Error("The spec is not an object.");
  }
  const create = requestBody(spec, source.create);
  const update = requestBody(spec, source.update);
  const read = responseBody(spec, source.read);

  const createProperties = propertiesOf(create.schema);
  const updateProperties = propertiesOf(update.schema);
  const required = new Set(Array.isArray(create.schema.required) ? create.schema.required : []);

  const writable: Record<string, ResourceField> = {};
  for (const name of new Set([
    ...Object.keys(createProperties),
    ...Object.keys(updateProperties),
  ])) {
    const declarations = [createProperties[name], updateProperties[name]]
      .filter((declaration) => declaration !== undefined)
      .map((declaration) => assertPlain(resolveRef(spec, declaration), `Field "${name}"`));
    writable[name] = {
      type: fieldType(spec, declarations[0]),
      required: required.has(name),
      nullable: declarations.some(isNullable),
    };
  }

  const readOnly = Object.keys(propertiesOf(read.schema))
    .filter((name) => !(name in writable))
    .sort();

  return { envelope: update.envelope, writable, readOnly };
}

/** Renders descriptors as a module of `<name>Fields` constants. */
export function renderResourceFields(
  resources: readonly (ResourceFields & { name: string })[],
): string {
  const header = "// Generated by @storyblok/openapi-codegen. Do not edit by hand.\n";
  const constants = resources.map(({ name, ...fields }) => {
    return `export const ${name}Fields = ${JSON.stringify(fields, null, 2)} as const;\n`;
  });
  return [header, ...constants].join("\n");
}
