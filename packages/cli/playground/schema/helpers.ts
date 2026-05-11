import type { Field } from '@storyblok/schema';

/**
 * Wraps a schema record and auto-assigns `pos` based on key order.
 *
 * Eliminates the need for `defineProp` and manual pos tracking — just
 * pass fields directly (via `defineField` or pre-defined field objects)
 * and positions are assigned sequentially.
 *
 * `required` can be set inline since it's already part of the field type.
 *
 * @example
 * defineBlock({
 *   name: 'hero',
 *   schema: wrap({
 *     headline: defineField({ type: 'text', required: true }),
 *     image: defineField({ type: 'asset', filetypes: ['images'] }),
 *   }),
 * });
 *
 * @example
 * // With pre-defined fields
 * defineBlock({
 *   name: 'hero',
 *   schema: wrap({
 *     headline: { ...headlineField, required: true },
 *     image: imageField,
 *   }),
 * });
 */
export function wrap<const T extends Record<string, Field>>(
  fields: T,
): { [K in keyof T]: T[K] & { pos: number } } {
  const result = {} as Record<string, Field & { pos: number }>;
  let pos = 0;
  for (const [key, value] of Object.entries(fields)) {
    result[key] = { ...value, pos: pos++ };
  }
  return result as { [K in keyof T]: T[K] & { pos: number } };
}
