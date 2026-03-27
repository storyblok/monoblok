import type { Component, ComponentSchema } from '../types/component';

const COMPONENT_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
};

/** Fields that are assigned by the API and can be omitted when defining a component. */
type ComponentApiAssigned = 'id' | 'created_at' | 'updated_at';

/**
 * Input type for `defineComponent` — all API-assigned fields are optional.
 * The output type (`Component`) still includes all fields.
 */
type ComponentInput<
  TName extends string = string,
  TSchema extends ComponentSchema = ComponentSchema,
> = Omit<Component<TName, TSchema>, ComponentApiAssigned> & Partial<Pick<Component<TName, TSchema>, ComponentApiAssigned>>;

/**
 * Defines a Storyblok component with its schema.
 * API-assigned fields (`id`, `created_at`, `updated_at`) are optional and default to safe values.
 * Returns a full `Component` with all fields populated.
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
  component: ComponentInput<TName, TSchema>,
): Component<TName, TSchema> => ({
  ...COMPONENT_DEFAULTS,
  ...component,
});
