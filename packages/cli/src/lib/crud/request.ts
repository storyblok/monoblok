// Turns a payload the shared code checked against the generated field
// descriptor into a resource's typed request body. The descriptor and the
// request types are generated from the same spec in the same run, so the body
// type derived from the descriptor is assignable to the request type; a
// resource that converts between them fails to compile when they drift.

import { CrudError } from "./errors";
import { fitsField } from "./fields";
import type { FieldValue, Payload, ResourceFields } from "./fields";
import type { Noun } from "./types";

type Writable<F extends ResourceFields> = F["writable"];

/** The fields the descriptor marks required on create. */
type RequiredFields<F extends ResourceFields> = {
  [K in keyof Writable<F>]: Writable<F>[K]["required"] extends true ? K : never;
}[keyof Writable<F>];

/** A request body with any of the descriptor's fields. */
export type RequestBody<F extends ResourceFields> = {
  -readonly [K in keyof Writable<F>]?: FieldValue<Writable<F>[K]>;
};

/** A request body with every field the descriptor requires on create. */
export type CreateBody<F extends ResourceFields> = RequestBody<F> & {
  -readonly [K in RequiredFields<F>]-?: FieldValue<Writable<F>[K]>;
};

function isBodyField<F extends ResourceFields>(
  fields: F,
  field: string,
): field is keyof Writable<F> & string {
  return Object.hasOwn(fields.writable, field);
}

function copyField<F extends ResourceFields, K extends keyof Writable<F>>(
  fields: F,
  body: RequestBody<F>,
  field: K,
  value: unknown,
): boolean {
  const writable: Writable<F> = fields.writable;
  const descriptor = writable[field];
  if (!fitsField(descriptor, value)) {
    return false;
  }
  body[field] = value;
  return true;
}

/**
 * The request body for the fields a payload holds. A field the body cannot
 * take fails the record instead of being dropped while the run reports
 * success.
 */
export function toRequestBody<F extends ResourceFields>(
  fields: F,
  payload: Payload,
  noun: Noun,
): RequestBody<F> {
  const body: RequestBody<F> = {};
  const rejected = Object.entries(payload)
    .filter(
      ([field, value]) => !(isBodyField(fields, field) && copyField(fields, body, field, value)),
    )
    .map(([field]) => field);
  if (rejected.length > 0) {
    throw new CrudError(
      `The CLI cannot write these ${noun.singular} fields: ${rejected.join(", ")}.`,
    );
  }
  return body;
}

/**
 * Whether the body holds every field the descriptor requires on create. The
 * shared code checks this before any request; this tells the compiler.
 */
export function hasRequiredFields<F extends ResourceFields>(
  fields: F,
  body: RequestBody<F>,
): body is CreateBody<F> {
  return Object.entries(fields.writable).every(
    ([field, descriptor]) => !descriptor.required || Object.hasOwn(body, field),
  );
}
