import type { FieldType } from '@storyblok/schema';

import type { Component } from '../../types';
import { isRecord } from './utils';

/** Field-schema keys that are internal Storyblok sentinels, never user-defined fields. */
const SENTINEL_FIELDS = new Set(['_uid', 'component']);

// Content field types the `@storyblok/schema` validators understand. Declaring
// this as `Record<FieldType, true>` makes it a compile-time exhaustiveness check:
// adding or removing a `FieldType` in the schema package fails to type-check here
// until this map is updated in lockstep.
const KNOWN_FIELD_TYPES = {
  text: true,
  textarea: true,
  richtext: true,
  markdown: true,
  number: true,
  datetime: true,
  boolean: true,
  option: true,
  options: true,
  asset: true,
  multiasset: true,
  multilink: true,
  bloks: true,
  table: true,
  section: true,
  tab: true,
  custom: true,
} satisfies Record<FieldType, true>;

function isKnownFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KNOWN_FIELD_TYPES, value);
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
  // Field types the validators cannot check (e.g. commerce, image, link) are
  // dropped: `validateStory` has no rule for them, so they never affect breakage.
  if (!isKnownFieldType(def.type)) {
    return null;
  }

  const field: AdaptedField = { ...def, name, type: def.type };

  // MAPI stores the allowed-blocks list for `bloks` fields as `component_whitelist`;
  // the validators expect it under `allow`.
  if (Array.isArray(def.component_whitelist)) {
    field.allow = def.component_whitelist.filter((entry): entry is string => typeof entry === 'string');
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
    blocks: components.map(component => ({
      name: component.name,
      fields: Object.entries(component.schema ?? {})
        .filter(([key]) => !SENTINEL_FIELDS.has(key))
        .map(([name, def]) => (isRecord(def) ? toField(name, def) : null))
        .filter((field): field is AdaptedField => field !== null),
    })),
  };
}
