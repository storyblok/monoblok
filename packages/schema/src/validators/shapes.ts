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
  // Value constraints enforced by `validateStory` (all optional).
  /** `text`/`textarea`/`markdown`: maximum string length. */
  max_length?: number;
  /** `text`/`textarea`: legacy alias for `max_length`. */
  maxlength?: number;
  /** `text`/`textarea`: minimum string length. */
  minlength?: number;
  /** `number`: inclusive lower bound. */
  min_value?: number;
  /** `number`: inclusive upper bound. */
  max_value?: number;
  /** `number`: maximum number of fractional digits. */
  decimals?: number;
  /** `number`: the value must be a multiple of this step (offset from `min_value`, else 0). */
  steps?: number;
  /** `bloks`: minimum number of nested blocks. */
  minimum?: number;
  /** `bloks`: maximum number of nested blocks. */
  maximum?: number;
  /** `multiasset`: minimum number of assets. */
  minimum_entries?: number;
  /** `multiasset`: maximum number of assets. */
  maximum_entries?: number;
  /** `options`: minimum number of selected options (stored as a string). */
  min_options?: string;
  /** `options`: maximum number of selected options (stored as a string). */
  max_options?: string;
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
