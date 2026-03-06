import type { Field, FieldType } from '../types/field';
import type { Prettify } from '../types/utils';

/**
 * Defines a reusable field configuration.
 * Returns the input as-is with a narrowed type based on the `type` discriminant.
 * Invalid keys for the given field type will produce a TypeScript error.
 *
 * @example
 * const headline = defineField({ type: 'text', max_length: 100 });
 * // type: { type: 'text'; max_length?: number; ... }
 */
export const defineField = <TFieldType extends FieldType>(
  field: Extract<Field, { type: TFieldType }>,
): Prettify<Extract<Field, { type: TFieldType }>> => field;
