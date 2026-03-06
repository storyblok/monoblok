import type { component } from '../generated/types';
import type { Prop } from './prop';
import type { Prettify } from './utils';

/** A record of named props forming a component's schema. */
export type ComponentSchema = Record<string, Prop>;

/**
 * A Storyblok component definition.
 * TName is the literal component name (e.g., "hero", "page").
 * TSchema is the record of props defining the component's fields.
 *
 * Metadata fields (display_name, is_root, is_nestable, etc.) are derived
 * from the generated `component` type. `name` and `schema` are overridden
 * with the generic parameters for type-safe inference.
 */
export type Component<
  TName extends string = string,
  TSchema extends ComponentSchema = ComponentSchema,
> = Prettify<
  Omit<component, 'name' | 'schema'> & {
    name: TName;
    schema: TSchema;
  }
>;
