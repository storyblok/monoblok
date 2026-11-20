// Turns a payload the shared code checked against the generated field
// descriptor into a resource's typed request body. The descriptor and the
// request types are generated from the same spec, so they agree; these
// helpers make the compiler hold a resource to that.

import { CrudError } from "./errors";
import type { Payload, ResourceFields } from "./fields";
import type { Noun } from "./types";

/**
 * Per request field, a check that a payload value fits it. A field the
 * request type gains without a guard here is a compile error.
 */
export type FieldGuards<T> = {
  [K in keyof Required<T>]: (value: unknown) => value is Required<T>[K];
};

/** The fields the descriptor marks required on create. */
export type RequiredFields<F extends ResourceFields> = {
  [K in keyof F["writable"]]: F["writable"][K]["required"] extends true ? K : never;
}[keyof F["writable"]];

function isGuarded<T>(guards: FieldGuards<T>, field: string): field is keyof T & string {
  return Object.hasOwn(guards, field);
}

function copyField<T, K extends keyof T>(
  body: Partial<T>,
  field: K,
  guard: (value: unknown) => value is Required<T>[K],
  value: unknown,
): boolean {
  if (!guard(value)) {
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
export function toRequestBody<T>(guards: FieldGuards<T>, payload: Payload, noun: Noun): Partial<T> {
  const body: Partial<T> = {};
  const rejected = Object.entries(payload)
    .filter(
      ([field, value]) =>
        !(isGuarded(guards, field) && copyField(body, field, guards[field], value)),
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
export function hasRequiredFields<T, F extends ResourceFields>(
  fields: F,
  body: Partial<T>,
): body is Partial<T> & Required<Pick<T, RequiredFields<F> & keyof T>> {
  return Object.entries(fields.writable).every(
    ([field, descriptor]) => !descriptor.required || Object.hasOwn(body, field),
  );
}
