// Turns a payload the shared code checked against the generated field
// descriptor into a resource's typed request body. Field types come from the
// descriptor; a `json` field, which the descriptor cannot type, comes from the
// request type and a guard the resource supplies. The descriptor and the
// request type are generated from the same spec, and a resource that converts
// between them fails to compile when they drift: when a type differs, when the
// request type has a field the descriptor lacks, or when a `json` field has no
// guard.

import { CrudError } from "./errors";
import { fitsField } from "./fields";
import type { FieldValue, Payload, ResourceFields } from "./fields";
import type { Noun } from "./types";

type Writable<F extends ResourceFields> = F["writable"];

type JsonFields<F extends ResourceFields> = {
  [K in keyof Writable<F>]: Writable<F>[K]["type"] extends "json" ? K : never;
}[keyof Writable<F>];

type RequiredFields<F extends ResourceFields> = {
  [K in keyof Writable<F>]: Writable<F>[K]["required"] extends true ? K : never;
}[keyof Writable<F>];

type BodyValue<
  F extends ResourceFields,
  T,
  K extends keyof Writable<F>,
> = Writable<F>[K]["type"] extends "json"
  ? K extends keyof T
    ? Exclude<T[K], undefined>
    : never
  : FieldValue<Writable<F>[K]>;

/** A request body with any of the descriptor's fields. */
export type RequestBody<F extends ResourceFields, T> = {
  -readonly [K in keyof Writable<F>]?: BodyValue<F, T, K>;
};

/** A request body with every field the descriptor requires on create. */
export type CreateBody<F extends ResourceFields, T> = RequestBody<F, T> & {
  -readonly [K in RequiredFields<F>]-?: BodyValue<F, T, K>;
};

/** Per `json` field, a check that a value fits the request type's field. */
export type JsonGuards<F extends ResourceFields, T> = {
  [K in JsonFields<F>]: (value: unknown) => value is BodyValue<F, T, K>;
};

/** Request fields the descriptor lacks. A compile error names them. */
type MissingFields<T, F extends ResourceFields> = Exclude<keyof T, keyof Writable<F>>;

type CoversRequest<T, F extends ResourceFields> = [MissingFields<T, F>] extends [never]
  ? unknown
  : { missingFields: MissingFields<T, F> };

type AnyGuard = (value: unknown) => boolean;

function fitsBodyField<F extends ResourceFields, T, K extends keyof Writable<F> & string>(
  fields: F,
  guards: Readonly<Record<string, AnyGuard>>,
  field: K,
  value: unknown,
): value is BodyValue<F, T, K> {
  return Object.hasOwn(guards, field)
    ? guards[field](value)
    : fitsField(fields.writable[field], value);
}

function isBodyField<F extends ResourceFields>(
  fields: F,
  field: string,
): field is keyof Writable<F> & string {
  return Object.hasOwn(fields.writable, field);
}

/**
 * Converts payloads into the request bodies of `T`. Called as
 * `requestBodies<WebhookUpdate>()(webhookFields, {}, noun)`: the request type is
 * named, the descriptor's type inferred.
 */
export function requestBodies<T>() {
  return <F extends ResourceFields>(
    fields: F & CoversRequest<T, F>,
    jsonGuards: JsonGuards<F, T>,
    noun: Noun,
  ) => {
    const guards: Readonly<Record<string, AnyGuard>> = jsonGuards;

    function copyField<K extends keyof Writable<F> & string>(
      body: RequestBody<F, T>,
      field: K,
      value: unknown,
    ): boolean {
      if (!fitsBodyField<F, T, K>(fields, guards, field, value)) {
        return false;
      }
      body[field] = value;
      return true;
    }

    /**
     * The body for the fields a payload holds. A field the body cannot take
     * fails the record instead of being dropped while the run reports success.
     */
    function update(payload: Payload): RequestBody<F, T> {
      const body: RequestBody<F, T> = {};
      const rejected = Object.entries(payload)
        .filter(([field, value]) => !(isBodyField(fields, field) && copyField(body, field, value)))
        .map(([field]) => field);
      if (rejected.length > 0) {
        throw new CrudError(
          `The CLI cannot write these ${noun.singular} fields: ${rejected.join(", ")}.`,
        );
      }
      return body;
    }

    /** The shared code checks required fields before any request; this tells the compiler. */
    function hasRequiredFields(body: RequestBody<F, T>): body is CreateBody<F, T> {
      return Object.entries(fields.writable).every(
        ([field, descriptor]) => !descriptor.required || Object.hasOwn(body, field),
      );
    }

    function create(payload: Payload): CreateBody<F, T> {
      const body = update(payload);
      if (!hasRequiredFields(body)) {
        throw new CrudError(`The ${noun.singular} lacks a required field.`);
      }
      return body;
    }

    return { update, create };
  };
}
