import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FieldType } from '../generated/types/field';

export { isRecord } from '../utils/is-record';

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
  /** `custom`: the field plugin discriminant, matched against registered `fieldPlugins`. */
  field_type?: string;
  required?: boolean;
  /** Normalized block-name or folder-path references for `bloks` fields. */
  allow?: readonly (string | { folder: string })[];
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
  /** Display path of the folder (component group) this block belongs to, if any. */
  folder?: string | null;
}

/** A datasource definition (`defineDatasource` result). */
export interface SchemaDatasourceLike {
  slug?: string;
}

/** A field plugin registration (`defineFieldPlugin` result). */
export interface FieldPluginLike {
  fieldType: string;
  value: StandardSchemaV1;
}

/** The schema object accepted by the validators: blocks (required), datasources and field plugins (optional). */
export interface SchemaLike {
  blocks: Record<string, SchemaBlockLike> | readonly SchemaBlockLike[];
  datasources?: Record<string, SchemaDatasourceLike> | readonly SchemaDatasourceLike[];
  fieldPlugins?: Record<string, FieldPluginLike> | readonly FieldPluginLike[];
}

/** Normalizes a record-or-array of entities to an array of values. */
export function toValues<T>(input: Record<string, T> | readonly T[] | undefined): T[] {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? [...input] : Object.values(input as Record<string, T>);
}
