import type { Component, ComponentSchema } from '../types/component';

/**
 * Defines a Storyblok component with its schema.
 * Returns the input as-is with a narrowed type preserving the literal `name` type
 * and the precise schema shape.
 *
 * @example
 * const pageComponent = defineComponent({
 *   name: 'page',
 *   schema: {
 *     headline: defineProp(headlineField, { pos: 1 }),
 *   },
 * });
 */
export const defineComponent = <
  TName extends string,
  TSchema extends ComponentSchema,
>(
  component: Component<TName, TSchema>,
): Component<TName, TSchema> => component;
