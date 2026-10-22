import { FIELD_TYPES, type FieldType } from "@storyblok/schema";

import type { Component } from "../../types";
import { isRecord } from "./utils";

/** Field-schema keys that are internal Storyblok sentinels, never user-defined fields. */
const SENTINEL_FIELDS = new Set(["_uid", "component"]);

function isKnownFieldType(value: unknown): value is FieldType {
  return FIELD_TYPES.some((fieldType) => fieldType === value);
}

/** A single field in the adapted schema, structurally compatible with the validators' `SchemaFieldLike`. */
export interface AdaptedField {
  name: string;
  type: FieldType;
  allow?: string[];
  [key: string]: unknown;
}

/** A block plus its fields, structurally compatible with the validators' `SchemaLike.blocks`. */
export interface AdaptedSchema {
  blocks: { name: string; fields: AdaptedField[] }[];
}

function toField(name: string, def: Record<string, unknown>): AdaptedField | null {
  // A type outside the field types the Management API accepts has no
  // `validateStory` rule, so it can never affect breakage.
  if (!isKnownFieldType(def.type)) {
    return null;
  }

  const field: AdaptedField = { ...def, name, type: def.type };

  // MAPI stores the allowed-blocks list for `bloks` fields as `component_whitelist`;
  // the validators expect it under `allow`. The editor only enforces the list
  // when `restrict_components` is on and the restriction is by component name,
  // so an inert list must not become an `allow` constraint here.
  if (
    Array.isArray(def.component_whitelist) &&
    def.restrict_components === true &&
    !def.restrict_type
  ) {
    field.allow = def.component_whitelist.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return field;
}

/**
 * Adapts MAPI components (a `schema` record keyed by field name) into the block
 * + fields-array shape accepted by the `@storyblok/schema` validators. The
 * result is passed to `validateStory` to detect content that a schema change
 * would break.
 */
export function toSchemaLike(components: Component[]): AdaptedSchema {
  return {
    blocks: components.map((component) => ({
      name: component.name,
      fields: Object.entries(component.schema ?? {})
        .filter(([key]) => !SENTINEL_FIELDS.has(key))
        .map(([name, def]) => (isRecord(def) ? toField(name, def) : null))
        .filter((field): field is AdaptedField => field !== null),
    })),
  };
}
