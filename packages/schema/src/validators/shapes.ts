import type { FieldType } from '../generated/types/field';

/**
 * Loose structural views of the content-shape definitions, used internally by
 * the validators. A real `Block` / `Datasource` (from the `define*` helpers) is
 * structurally assignable to these, but they also tolerate the plain objects a
 * validator may receive at runtime.
 */

/** A single field within a block's `fields` array. */
export interface SchemaFieldLike {
  name: string;
  type: FieldType;
  required?: boolean;
  /** Normalized block-name references for `bloks` fields. */
  allow?: readonly string[];
  /** Normalized datasource slug for option/options fields. */
  datasource?: string;
}

/** A block definition (`defineBlock` result). */
export interface SchemaBlockLike {
  name: string;
  fields?: readonly SchemaFieldLike[];
}

/** A datasource definition (`defineDatasource` result). */
export interface SchemaDatasourceLike {
  slug?: string;
}

/** The schema object accepted by the validators: blocks (required) and datasources (optional). */
export interface SchemaLike {
  blocks: Record<string, SchemaBlockLike> | readonly SchemaBlockLike[];
  datasources?: Record<string, SchemaDatasourceLike> | readonly SchemaDatasourceLike[];
}

/** Normalizes a record-or-array of entities to an array of values. */
export function toValues<T>(input: Record<string, T> | readonly T[] | undefined): T[] {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? [...input] : Object.values(input as Record<string, T>);
}

/** Type guard for a plain object (record). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
