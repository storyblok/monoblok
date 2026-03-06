import type { Story as StoryCapi } from '../generated/types';
import type { Component } from './component';
import type { FieldValue } from './field';
import type { Prettify } from './utils';

/**
 * The content object of a story, typed to a specific component.
 * - `component` is always the literal component name.
 * - `_uid` is always present (assigned by Storyblok, optional in defineStory input).
 * - All other keys come from the component schema, typed to their value shapes.
 * - For `bloks` fields with a `component_whitelist`, the value type is narrowed:
 *   - When `TSchema` is provided, blok items are fully typed as `StoryContent<T>`
 *     for each whitelisted component found in `TSchema`.
 *   - Without `TSchema`, blok items fall back to `{ component: TName; _uid: string; [key: string]: unknown }`.
 *
 * @param TComponent - The component definition this content belongs to.
 * @param TSchema - Optional union of all component definitions in scope, used to
 *   resolve the full types of nested blok fields.
 */
export type StoryContent<
  TComponent extends Component = Component,
  TSchema extends Component = never,
> = Prettify<
  { component: TComponent['name']; _uid?: string } &
  {
    [K in keyof TComponent['schema']]: FieldValue<TComponent['schema'][K], TSchema>
  }
>;

/**
 * A Storyblok CAPI story typed to a specific component.
 * Metadata fields are derived from the generated Story type.
 * The `content` field is overridden with a component-aware generic.
 *
 * @param TComponent - The component definition for this story's content.
 * @param TSchema - Optional union of all component definitions in scope, forwarded
 *   to `StoryContent` to enable full typing of nested blok fields.
 */
export type Story<
  TComponent extends Component = Component,
  TSchema extends Component = never,
> = Prettify<
  Omit<StoryCapi, 'content'> & {
    content: StoryContent<TComponent, TSchema>;
  }
>;
