import type { Component as ComponentGenerated } from '../generated/mapi-types';
import type { Prop } from './prop';
import type { Prettify } from './utils';

/** A record of named props forming a component's schema. */
export type ComponentSchema = Record<string, Prop>;

/**
 * A Storyblok component definition.
 *
 * @typeParam TName - Literal component name (e.g., `'hero'`, `'page'`).
 * @typeParam TSchema - Record of props defining the component's fields.
 */
export type Component<
  TName extends string = string,
  TSchema extends ComponentSchema = ComponentSchema,
> = Prettify<
  Omit<ComponentGenerated, 'name' | 'schema'> & {
    name: TName;
    schema: TSchema;
  }
>;
