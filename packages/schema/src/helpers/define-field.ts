import type { Field, FieldType } from '../types/field';

/**
 * Defines a reusable field configuration.
 * Returns the input as-is with a narrowed type based on the `type` discriminant.
 * Invalid keys for the given field type will produce a TypeScript error.
 *
 * The `const` generic preserves literal array values (e.g. `component_whitelist`)
 * so that bloks fields can carry type-level information about allowed components.
 *
 * @example
 * const headline = defineField({ type: 'text', max_length: 100 });
 * // type: { type: 'text'; max_length?: number; ... }
 *
 * @example
 * const bloks = defineField({ type: 'bloks', component_whitelist: ['teaser', 'hero'] });
 * // component_whitelist: readonly ['teaser', 'hero'] — literal types preserved
 */
export const defineField = <
  TFieldType extends FieldType,
  const TField extends Extract<Field, { type: TFieldType }>,
>(
  field: TField,
): TField => field;
