// Field-level writes: `--set`, `--unset`, `--data` and input lines, checked
// against a resource's generated field descriptor and composed into the body of
// one request.

import { isRecord } from "../../utils/object";
import { isSidecarKey } from "../pipe/contract";
import { CrudError, usageError } from "./errors";

export type FieldType = "string" | "boolean" | "number" | "string[]" | "json";

export type FieldDescriptor = {
  readonly type: FieldType;
  readonly required: boolean;
  readonly nullable: boolean;
};

/** The shape `generate:openapi` emits per resource into `src/generated/mapi/resource-fields.gen.ts`. */
export type ResourceFields = {
  readonly envelope: string;
  readonly writable: Readonly<Record<string, FieldDescriptor>>;
  readonly readOnly: readonly string[];
};

export type Payload = Record<string, unknown>;

/** What the flags ask for, parsed once per run and applied to every record. */
export type FlagPatch = {
  /** `--data`, applied as a JSON Merge Patch. */
  data?: Payload;
  /** `--set` and `--unset`, each replacing its field. */
  assignments: Payload;
};

const SET_SYNTAX = "<field>=<value>";

/** Own keys only: `toString` or `__proto__` must not pass as fields. */
function writableField(fields: ResourceFields, field: string): FieldDescriptor | undefined {
  return Object.hasOwn(fields.writable, field) ? fields.writable[field] : undefined;
}

function assertWritable(fields: ResourceFields, field: string, flag: string): FieldDescriptor {
  const descriptor = writableField(fields, field);
  if (descriptor) {
    return descriptor;
  }
  const valid = Object.keys(fields.writable).join(", ");
  if (fields.readOnly.includes(field)) {
    throw usageError(`${flag}: "${field}" is read-only. Writable fields: ${valid}.`);
  }
  throw usageError(`${flag}: unknown field "${field}". Writable fields: ${valid}.`);
}

function assertNullable(fields: ResourceFields, field: string, flag: string): void {
  if (writableField(fields, field)?.nullable) {
    return;
  }
  const nullable = Object.entries(fields.writable)
    .filter(([, descriptor]) => descriptor.nullable)
    .map(([name]) => name);
  throw usageError(
    `${flag}: "${field}" cannot be cleared. Fields that can: ${nullable.join(", ") || "none"}.`,
  );
}

/** Coerces a `--set` value. The message never repeats the value: it may be a secret. */
function coerce(field: string, descriptor: FieldDescriptor, value: string): unknown {
  switch (descriptor.type) {
    case "string":
      return value;
    case "boolean":
      if (value === "true" || value === "false") {
        return value === "true";
      }
      throw usageError(`--set: "${field}" takes true or false.`);
    case "number": {
      const number = Number(value);
      if (value.trim() === "" || Number.isNaN(number)) {
        throw usageError(`--set: "${field}" takes a number.`);
      }
      return number;
    }
    case "string[]":
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        throw usageError(`--set: "${field}" takes JSON.`);
      }
  }
}

function parseData(fields: ResourceFields, raw: string): Payload {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw usageError("--data is not valid JSON.");
  }
  if (!isRecord(data)) {
    throw usageError("--data takes a JSON object.");
  }
  for (const [field, value] of Object.entries(data)) {
    const descriptor = assertWritable(fields, field, "--data");
    if (value === null) {
      assertNullable(fields, field, "--data");
    } else if (!holdsType(descriptor.type, value)) {
      throw usageError(`--data: "${field}" takes ${TYPE_NAMES[descriptor.type]}.`);
    }
  }
  return data;
}

/** Parses the payload flags of one run. Throws a usage error (exit 2) on any mistake. */
export function parseFlagPatch(
  fields: ResourceFields,
  flags: { set: readonly string[]; unset: readonly string[]; data?: string },
): FlagPatch {
  const assignments: Payload = {};
  // A second value would silently replace the first, even for a list field.
  const assertOnce = (field: string): void => {
    if (Object.hasOwn(assignments, field)) {
      throw usageError(`"${field}" is given more than once in --set and --unset.`);
    }
  };
  for (const assignment of flags.set) {
    const separator = assignment.indexOf("=");
    if (separator <= 0) {
      throw usageError(`--set takes ${SET_SYNTAX}.`);
    }
    const field = assignment.slice(0, separator);
    const descriptor = assertWritable(fields, field, "--set");
    assertOnce(field);
    assignments[field] = coerce(field, descriptor, assignment.slice(separator + 1));
  }
  for (const field of flags.unset) {
    assertWritable(fields, field, "--unset");
    assertNullable(fields, field, "--unset");
    assertOnce(field);
    assignments[field] = null;
  }
  return {
    data: flags.data === undefined ? undefined : parseData(fields, flags.data),
    assignments,
  };
}

/** RFC 7386: `null` removes a key, objects merge, anything else replaces. */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isRecord(patch)) {
    return patch;
  }
  const result: Payload = isRecord(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = mergePatch(result[key], value);
    }
  }
  return result;
}

/**
 * The writable fields of an input line. Read-only, sidecar and unknown keys
 * are dropped, so a field the API adds later does not break the pipe; a typo
 * is dropped too (ADR-0029).
 */
export function pickWritable(fields: ResourceFields, line: Payload | undefined): Payload {
  const writable: Payload = {};
  for (const [key, value] of Object.entries(line ?? {})) {
    if (!isSidecarKey(key) && writableField(fields, key)) {
      writable[key] = value;
    }
  }
  return writable;
}

const TYPE_NAMES: Record<FieldType, string> = {
  string: "a string",
  boolean: "true or false",
  number: "a number",
  "string[]": "a list of strings",
  json: "JSON",
};

function holdsType(type: FieldType, value: unknown): boolean {
  switch (type) {
    case "string":
    case "boolean":
    case "number":
      return typeof value === type;
    case "string[]":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "json":
      return true;
  }
}

/**
 * Fails a record whose field cannot be what the API expects. Flags are
 * coerced on parsing, so this catches input lines.
 */
function assertFieldTypes(fields: ResourceFields, payload: Payload, given: Set<string>): void {
  for (const [field, value] of Object.entries(payload)) {
    const descriptor = writableField(fields, field);
    if (!given.has(field)) {
      continue;
    }
    if (!descriptor) {
      continue;
    }
    if (value === null ? descriptor.nullable : holdsType(descriptor.type, value)) {
      continue;
    }
    throw new CrudError(`"${field}" takes ${TYPE_NAMES[descriptor.type]}.`);
  }
}

/** A list field holding a value twice: the API would store it twice. */
function withUniqueLists(fields: ResourceFields, payload: Payload): Payload {
  return Object.fromEntries(
    Object.entries(payload).map(([field, value]) => [
      field,
      writableField(fields, field)?.type === "string[]" && Array.isArray(value)
        ? [...new Set(value)]
        : value,
    ]),
  );
}

/**
 * The fields a record should have after the write: the server's record
 * (`base`, on update), then the input line, then `--data` as a JSON Merge
 * Patch, then `--set`/`--unset`. A top-level `null` in `--data` clears the
 * field rather than leaving it out: leaving it out would keep the server's
 * value.
 */
export function composePayload(
  fields: ResourceFields,
  line: Payload | undefined,
  patch: FlagPatch,
  base?: Payload,
): Payload {
  const fromLine = pickWritable(fields, line);
  const payload = { ...pickWritable(fields, base), ...fromLine };
  for (const [field, value] of Object.entries(patch.data ?? {})) {
    payload[field] = value === null ? null : mergePatch(payload[field], value);
  }
  const composed = { ...payload, ...patch.assignments };
  const given = new Set([
    ...Object.keys(fromLine),
    ...Object.keys(patch.data ?? {}),
    ...Object.keys(patch.assignments),
  ]);
  assertFieldTypes(fields, composed, given);
  return withUniqueLists(fields, composed);
}

/** The API rejects these as blank, so a required field holding one is missing. */
function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Required fields the payload lacks or holds blank, for validating a write before it is sent. */
export function missingRequired(fields: ResourceFields, payload: Payload): string[] {
  return Object.entries(fields.writable)
    .filter(([field, descriptor]) => descriptor.required && isBlank(payload[field]))
    .map(([field]) => field);
}
